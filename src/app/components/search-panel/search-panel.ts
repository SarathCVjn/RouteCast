import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, of, map, Subject, forkJoin, Subscription } from 'rxjs';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonList,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  navigateCircleOutline, locateOutline, flagOutline,
  calendarOutline, timeOutline, searchOutline,
  locationOutline, warningOutline, mapOutline, checkmarkCircle,
} from 'ionicons/icons';
import { MapService } from '../../services/map.service';
import { WeatherService } from '../../services/weather.service';
import { GeocodeSuggestion, MapboxStep, RouteOption } from '../../models/route.model';

@Component({
  selector: 'app-search-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonList,
  ],
  templateUrl: './search-panel.html',
  styleUrl: './search-panel.scss',
})
export class SearchPanelComponent implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private weatherService = inject(WeatherService);
  private subs = new Subscription();

  private originInput$ = new Subject<string>();
  private destinationInput$ = new Subject<string>();

  originQuery = signal('');
  destinationQuery = signal('');
  originSuggestions = signal<GeocodeSuggestion[]>([]);
  destinationSuggestions = signal<GeocodeSuggestion[]>([]);
  selectedOrigin = signal<GeocodeSuggestion | null>(null);
  selectedDestination = signal<GeocodeSuggestion | null>(null);

  departureDate = signal(this.todayString());
  departureTime = signal(this.currentTimeString());

  isLoading = signal(false);
  error = signal<string | null>(null);
  routeOptions = signal<RouteOption[]>([]);
  selectedRouteIndex = signal(0);

  readonly Math = Math;

  constructor() {
    addIcons({
      navigateCircleOutline, locateOutline, flagOutline,
      calendarOutline, timeOutline, searchOutline,
      locationOutline, warningOutline, mapOutline, checkmarkCircle,
    });
  }

  ngOnInit(): void {
    this.subs.add(
      this.originInput$.pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => q.length > 2 ? this.mapService.geocode(q) : of([]))
      ).subscribe((s) => this.originSuggestions.set(s))
    );

    this.subs.add(
      this.destinationInput$.pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => q.length > 2 ? this.mapService.geocode(q) : of([]))
      ).subscribe((s) => this.destinationSuggestions.set(s))
    );

    // When user clicks a route line on the map, sync with the panel
    this.subs.add(
      this.mapService.routeClicked$.subscribe((index) => this.selectRoute(index))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onOriginInput(event: Event): void {
    const value = (event as CustomEvent).detail.value ?? '';
    this.originQuery.set(value);
    this.selectedOrigin.set(null);
    this.originInput$.next(value);
  }

  onDestinationInput(event: Event): void {
    const value = (event as CustomEvent).detail.value ?? '';
    this.destinationQuery.set(value);
    this.selectedDestination.set(null);
    this.destinationInput$.next(value);
  }

  selectOrigin(s: GeocodeSuggestion): void {
    this.selectedOrigin.set(s);
    this.originQuery.set(s.place_name);
    this.originSuggestions.set([]);
  }

  selectDestination(s: GeocodeSuggestion): void {
    this.selectedDestination.set(s);
    this.destinationQuery.set(s.place_name);
    this.destinationSuggestions.set([]);
  }

  onDateChange(event: Event): void {
    this.departureDate.set((event as CustomEvent).detail.value ?? this.todayString());
  }

  onTimeChange(event: Event): void {
    this.departureTime.set((event as CustomEvent).detail.value ?? this.currentTimeString());
  }

  searchRoute(): void {
    const origin = this.selectedOrigin();
    const destination = this.selectedDestination();
    if (!origin || !destination) {
      this.error.set('Please select origin and destination from the dropdown suggestions.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.routeOptions.set([]);

    const departureTime = this.getDepartureDateTime();

    this.mapService.getDirections(origin.center, destination.center).pipe(
      switchMap((rawRoutes) => {
        // Fetch weather for ALL routes in parallel with ETA-accurate waypoints
        const requests = rawRoutes.map((route) => {
          const waypoints = this.extractWaypoints(route.steps, departureTime);
          return this.weatherService.getWeatherAlongRoute(waypoints).pipe(
            map((weatherSegments) => ({
              ...route,
              weatherSegments,
              avgRainProbability: weatherSegments.length
                ? Math.round(weatherSegments.reduce((s, w) => s + w.rainProbability, 0) / weatherSegments.length)
                : 0,
            } as RouteOption))
          );
        });
        return forkJoin(requests);
      })
    ).subscribe({
      next: (routes) => {
        this.routeOptions.set(routes);
        this.selectedRouteIndex.set(0);
        this.mapService.clearRoute();
        this.mapService.renderRoutes(routes, 0, departureTime);
        this.mapService.addRouteMarkers(origin.center, destination.center);
        this.mapService.fitAllRoutesToView(routes);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not find route. Please check your inputs and try again.');
        this.isLoading.set(false);
      },
    });
  }

  selectRoute(index: number): void {
    this.selectedRouteIndex.set(index);
    this.mapService.renderRoutes(this.routeOptions(), index, this.getDepartureDateTime());
  }

  private getDepartureDateTime(): Date {
    return new Date(`${this.departureDate()}T${this.departureTime()}:00`);
  }

  routeLabel(route: RouteOption, allRoutes: RouteOption[]): string {
    const fastest = allRoutes.reduce((a, b) => a.duration < b.duration ? a : b);
    const shortest = allRoutes.reduce((a, b) => a.distance < b.distance ? a : b);
    if (route.index === fastest.index) return 'Fastest';
    if (route.index === shortest.index) return 'Shortest';
    return 'Alternative';
  }

  formatDistance(metres: number): string {
    return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  /**
   * Samples up to maxWaypoints evenly along the route steps.
   * Each waypoint gets the ETA based on cumulative driving time from departure.
   */
  private extractWaypoints(steps: MapboxStep[], departureTime: Date, maxWaypoints = 12) {
    const stride = Math.max(1, Math.floor(steps.length / maxWaypoints));
    const waypoints: { coordinates: [number, number]; arrivalTime: Date }[] = [];
    let cumulativeMs = 0;

    for (let i = 0; i < steps.length; i++) {
      if (i % stride === 0) {
        const coords = steps[i].geometry.coordinates;
        const midCoord = coords[Math.floor(coords.length / 2)];
        waypoints.push({
          coordinates: midCoord,
          arrivalTime: new Date(departureTime.getTime() + cumulativeMs),
        });
      }
      cumulativeMs += steps[i].duration * 1000;
    }
    return waypoints;
  }

  private todayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private currentTimeString(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
