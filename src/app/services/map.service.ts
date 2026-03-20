import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';
import { GeocodeSuggestion, MapboxStep, RawRoute, RouteOption, WeatherSegment } from '../models/route.model';

@Injectable({ providedIn: 'root' })
export class MapService {
  private http = inject(HttpClient);
  private map: mapboxgl.Map | null = null;
  private originMarker: mapboxgl.Marker | null = null;
  private destinationMarker: mapboxgl.Marker | null = null;
  private hoverPopup: mapboxgl.Popup | null = null;
  private routeLabels: mapboxgl.Marker[] = [];

  readonly mapReady = signal(false);
  readonly routeClicked$ = new Subject<number>();

  initMap(containerId: string): void {
    (mapboxgl as any).accessToken = environment.mapboxToken;

    this.map = new mapboxgl.Map({
      container: containerId,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    });

    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    this.map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    this.map.on('load', () => {
      this.mapReady.set(true);
      this.setupHoverInteraction();
      this.centerOnUserLocation();
    });
  }

  private centerOnUserLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.map!.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 10,
          speed: 1.4,
        });
      },
      (err) => console.error('Geolocation error:', err.code, err.message),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  geocode(query: string): Observable<GeocodeSuggestion[]> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${environment.mapboxToken}&limit=5&types=place,address,poi`;
    return this.http.get<any>(url).pipe(
      map((res) =>
        res.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center as [number, number],
        }))
      )
    );
  }

  getDirections(origin: [number, number], destination: [number, number]): Observable<RawRoute[]> {
    const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&steps=true&overview=full&alternatives=true&access_token=${environment.mapboxToken}`;

    return this.http.get<any>(url).pipe(
      map((res) =>
        res.routes.map((route: any, index: number) => ({
          index,
          distance: route.distance,
          duration: route.duration,
          steps: route.legs[0].steps,
        }))
      )
    );
  }

  renderRoutes(routes: RouteOption[], selectedIndex: number, departureTime: Date): void {
    if (!this.map) return;
    this.clearRouteLayers();

    // --- Unselected routes (gray, drawn first so they sit below) ---
    const otherRoutes = routes.filter((_, i) => i !== selectedIndex);
    if (otherRoutes.length > 0) {
      const features = otherRoutes.map((r) => ({
        type: 'Feature' as const,
        properties: { routeIndex: r.index },
        geometry: {
          type: 'LineString' as const,
          coordinates: r.steps.flatMap((s) => s.geometry.coordinates),
        },
      }));

      this.map.addSource('routes-other', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });
      this.map.addLayer({
        id: 'routes-other-line',
        type: 'line',
        source: 'routes-other',
        paint: { 'line-color': '#888', 'line-width': 5, 'line-opacity': 0.45 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      this.map.on('click', 'routes-other-line', (e) => {
        const idx = e.features?.[0]?.properties?.['routeIndex'];
        if (idx != null) this.routeClicked$.next(Number(idx));
      });
      this.map.on('mouseenter', 'routes-other-line', () => {
        this.map!.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'routes-other-line', () => {
        this.map!.getCanvas().style.cursor = '';
      });
    }

    // --- Selected route (weather colors, drawn on top) ---
    const selected = routes[selectedIndex];
    let cumulativeMs = 0;
    const selectedFeatures = selected.steps.map((step) => {
      const nearest = this.findNearestSegment(
        step.geometry.coordinates[0] as [number, number],
        selected.weatherSegments
      );
      const arrivalTime = new Date(departureTime.getTime() + cumulativeMs);
      const timeStr = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      cumulativeMs += step.duration * 1000;
      return {
        type: 'Feature' as const,
        properties: { color: nearest.color, rainProbability: nearest.rainProbability, temperature: nearest.temperature, arrivalTime: timeStr },
        geometry: step.geometry,
      };
    });

    this.map.addSource('route-selected', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: selectedFeatures },
    });
    this.map.addLayer({
      id: 'route-selected-casing',
      type: 'line',
      source: 'route-selected',
      paint: { 'line-color': '#000', 'line-width': 10, 'line-opacity': 0.35, 'line-blur': 3 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    this.map.addLayer({
      id: 'route-selected-line',
      type: 'line',
      source: 'route-selected',
      paint: { 'line-color': ['get', 'color'], 'line-width': 6 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });

    // --- 10 persistent weather labels along the selected route ---
    this.addRouteLabels(selected, departureTime);
  }

  addRouteMarkers(origin: [number, number], destination: [number, number]): void {
    if (!this.map) return;
    this.originMarker?.remove();
    this.destinationMarker?.remove();

    const originEl = document.createElement('div');
    originEl.innerHTML = `<div style="
      width:20px;height:20px;background:#4285F4;
      border:3px solid #fff;border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.55);cursor:default;
    "></div>`;
    this.originMarker = new mapboxgl.Marker({ element: originEl, anchor: 'center' })
      .setLngLat(origin)
      .addTo(this.map);

    this.destinationMarker = new mapboxgl.Marker({ color: '#EA4335' })
      .setLngLat(destination)
      .addTo(this.map);
  }

  fitAllRoutesToView(routes: RouteOption[]): void {
    if (!this.map || routes.length === 0) return;
    const allCoords: [number, number][] = routes.flatMap((r) =>
      r.steps.flatMap((s) => s.geometry.coordinates)
    );
    const bounds = allCoords.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
    );
    this.map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 420, right: 60 },
      maxZoom: 14,
    });
  }

  clearRoute(): void {
    this.clearRouteLayers();
    this.originMarker?.remove();
    this.destinationMarker?.remove();
    this.hoverPopup?.remove();
    this.originMarker = null;
    this.destinationMarker = null;
  }

  private clearRouteLayers(): void {
    if (!this.map) return;
    ['route-selected-line', 'route-selected-casing', 'routes-other-line'].forEach((id) => {
      if (this.map!.getLayer(id)) this.map!.removeLayer(id);
    });
    ['route-selected', 'routes-other'].forEach((id) => {
      if (this.map!.getSource(id)) this.map!.removeSource(id);
    });
    this.routeLabels.forEach((m) => m.remove());
    this.routeLabels = [];
  }

  /**
   * Places 10 evenly-spaced labels along the route.
   * Each label shows the rain probability and the ETA at that point.
   */
  private addRouteLabels(route: RouteOption, departureTime: Date): void {
    if (!this.map) return;

    const totalMs = route.steps.reduce((sum, s) => sum + s.duration * 1000, 0);

    for (let i = 0; i < 10; i++) {
      // Place labels at 5%, 15%, 25%, ..., 95% of route — midpoints of each 10th
      const fraction = (i + 0.5) / 10;
      const targetMs = totalMs * fraction;

      const coord = this.getPointAtDuration(route.steps, targetMs);
      if (!coord) continue;

      const arrivalTime = new Date(departureTime.getTime() + targetMs);
      const timeStr = arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const nearest = this.findNearestSegment(coord, route.weatherSegments);
      const rain = Math.round(nearest.rainProbability);
      const temp = Math.round(nearest.temperature);
      const color = nearest.color;

      const el = document.createElement('div');
      el.style.pointerEvents = 'none';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="
            background:rgba(12,12,24,0.9);
            border:1px solid rgba(255,255,255,0.12);
            border-radius:8px;
            padding:3px 8px;
            display:flex;flex-direction:column;align-items:center;
            backdrop-filter:blur(8px);
            box-shadow:0 2px 10px rgba(0,0,0,0.55);
          ">
            <span style="font-size:12px;font-weight:700;color:${color};font-family:-apple-system,sans-serif;">${rain}%</span>
            <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.75);font-family:-apple-system,sans-serif;margin-top:1px;">${temp}°C</span>
            <span style="font-size:9px;color:rgba(255,255,255,0.5);font-family:-apple-system,sans-serif;margin-top:-1px;">${timeStr}</span>
          </div>
          <div style="width:1px;height:6px;background:rgba(255,255,255,0.2);"></div>
          <div style="width:6px;height:6px;background:${color};border-radius:50%;border:1px solid rgba(255,255,255,0.35);"></div>
        </div>`;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coord)
        .addTo(this.map!);

      this.routeLabels.push(marker);
    }
  }

  /**
   * Walks through the steps and returns the coordinate at the given cumulative duration.
   */
  private getPointAtDuration(steps: MapboxStep[], targetMs: number): [number, number] | null {
    let cumMs = 0;
    for (const step of steps) {
      const stepMs = step.duration * 1000;
      if (cumMs + stepMs >= targetMs) {
        const fraction = stepMs > 0 ? (targetMs - cumMs) / stepMs : 0;
        const coords = step.geometry.coordinates;
        const idx = Math.min(Math.floor(fraction * coords.length), coords.length - 1);
        return coords[idx];
      }
      cumMs += stepMs;
    }
    // Past the end — return last coordinate of last step
    const lastStep = steps[steps.length - 1];
    return lastStep?.geometry.coordinates[lastStep.geometry.coordinates.length - 1] ?? null;
  }

  private setupHoverInteraction(): void {
    if (!this.map) return;
    this.hoverPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'weather-popup',
      offset: 12,
    });

    this.map.on('mousemove', 'route-selected-line', (e) => {
      this.map!.getCanvas().style.cursor = 'pointer';
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      const rain = Math.round(feature.properties['rainProbability'] ?? 0);
      const temp = Math.round(feature.properties['temperature'] ?? 0);
      const color = feature.properties['color'] ?? '#4CAF50';
      const time = feature.properties['arrivalTime'] ?? '';
      this.hoverPopup!
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="weather-popup-content">
            <span class="rain-dot" style="background:${color}"></span>
            Rain: <strong>${rain}%</strong> &middot; ${temp}°C${time ? ` &middot; ${time}` : ''}
          </div>`
        )
        .addTo(this.map!);
    });

    this.map.on('mouseleave', 'route-selected-line', () => {
      this.map!.getCanvas().style.cursor = '';
      this.hoverPopup?.remove();
    });
  }

  private findNearestSegment(coord: [number, number], segments: WeatherSegment[]): WeatherSegment {
    let nearest = segments[0];
    let minDist = Infinity;
    segments.forEach((seg) => {
      const dx = coord[0] - seg.coordinates[0];
      const dy = coord[1] - seg.coordinates[1];
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = seg; }
    });
    return nearest;
  }
}
