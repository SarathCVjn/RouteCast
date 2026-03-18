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
      cumulativeMs += step.duration * 1000;
      return {
        type: 'Feature' as const,
        properties: { color: nearest.color, rainProbability: nearest.rainProbability },
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
