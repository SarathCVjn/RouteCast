import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { WeatherSegment } from '../models/route.model';

interface WaypointInput {
  coordinates: [number, number];
  arrivalTime: Date;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  getWeatherAlongRoute(waypoints: WaypointInput[]): Observable<WeatherSegment[]> {
    if (waypoints.length === 0) return of([]);

    const requests = waypoints.map((wp) =>
      this.getWeatherAtPoint(wp.coordinates[1], wp.coordinates[0], wp.arrivalTime)
    );

    return forkJoin(requests).pipe(
      map((results) =>
        waypoints.map((wp, i) => ({
          coordinates: wp.coordinates,
          rainProbability: results[i].rain,
          temperature: results[i].temp,
          color: this.getRainColor(results[i].rain),
        }))
      )
    );
  }

  private getWeatherAtPoint(lat: number, lon: number, targetTime: Date): Observable<{ rain: number; temp: number }> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=precipitation_probability,temperature_2m&timezone=auto&forecast_days=7`;

    return this.http.get<any>(url).pipe(
      map((response) => {
        const times: string[] = response.hourly.time;
        const probs: number[] = response.hourly.precipitation_probability;
        const temps: number[] = response.hourly.temperature_2m;
        const targetMs = targetTime.getTime();

        let closestIndex = 0;
        let minDiff = Infinity;
        times.forEach((t, i) => {
          const diff = Math.abs(new Date(t).getTime() - targetMs);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        });

        return {
          rain: probs[closestIndex] ?? 0,
          temp: temps[closestIndex] ?? 0,
        };
      }),
      catchError(() => of({ rain: 0, temp: 0 }))
    );
  }

  getRainColor(probability: number): string {
    if (probability <= 10) return '#4CAF50'; // green
    if (probability <= 25) return '#8BC34A'; // light green
    if (probability <= 45) return '#FFC107'; // amber
    if (probability <= 65) return '#FF9800'; // orange
    if (probability <= 80) return '#F44336'; // red
    return '#1565C0';                        // heavy rain blue
  }
}
