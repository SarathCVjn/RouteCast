import { Component, AfterViewInit, inject } from '@angular/core';
import { MapService } from './services/map.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  private mapService = inject(MapService);

  ngAfterViewInit(): void {
    this.mapService.initMap('map');
  }
}
