import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonCard, IonCardContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-weather-legend',
  standalone: true,
  imports: [CommonModule, IonCard, IonCardContent],
  templateUrl: './weather-legend.html',
  styleUrl: './weather-legend.scss',
})
export class WeatherLegendComponent {
  readonly items = [
    { color: '#4CAF50', label: '0–10%' },
    { color: '#8BC34A', label: '10–25%' },
    { color: '#FFC107', label: '25–45%' },
    { color: '#FF9800', label: '45–65%' },
    { color: '#F44336', label: '65–80%' },
    { color: '#1565C0', label: '80%+' },
  ];
}
