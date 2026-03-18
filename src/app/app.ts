import { Component, AfterViewInit, inject } from '@angular/core';
import { MapService } from './services/map.service';
import { SearchPanelComponent } from './components/search-panel/search-panel';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SearchPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  private mapService = inject(MapService);

  ngAfterViewInit(): void {
    this.mapService.initMap('map');
  }
}
