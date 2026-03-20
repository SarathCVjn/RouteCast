export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
}

export interface WeatherSegment {
  coordinates: [number, number];
  rainProbability: number;
  temperature: number; // °C at this waypoint's ETA
  color: string;
}

export interface MapboxStep {
  duration: number;
  distance: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

/** Raw route from Mapbox — no weather data yet */
export interface RawRoute {
  index: number;
  distance: number; // metres
  duration: number; // seconds
  steps: MapboxStep[];
}

/** Route with weather loaded — ready to render */
export interface RouteOption extends RawRoute {
  weatherSegments: WeatherSegment[];
  avgRainProbability: number;
}
