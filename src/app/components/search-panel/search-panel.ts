import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, of, Subject, Subscription } from 'rxjs';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonList,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  navigateCircleOutline, locateOutline, flagOutline,
  calendarOutline, timeOutline, searchOutline,
  locationOutline, warningOutline,
} from 'ionicons/icons';
import { MapService } from '../../services/map.service';
import { GeocodeSuggestion } from '../../models/route.model';

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

  constructor() {
    addIcons({
      navigateCircleOutline, locateOutline, flagOutline,
      calendarOutline, timeOutline, searchOutline,
      locationOutline, warningOutline,
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
    this.error.set(null);
    // Route search will be implemented in the next step
  }

  private todayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private currentTimeString(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}
