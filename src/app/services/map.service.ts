import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';
import { GeocodeSuggestion } from '../models/route.model';

@Injectable({ providedIn: 'root' })
export class MapService {
  private http = inject(HttpClient);
  private map: mapboxgl.Map | null = null;

  readonly mapReady = signal(false);

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
}
