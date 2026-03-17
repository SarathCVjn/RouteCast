export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
}
