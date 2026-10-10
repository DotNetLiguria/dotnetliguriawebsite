export interface LocationModel {
  name: string;
  coordinates: string;
  address: string;
  googleMapsUrl?: string;
  maximumSpaces: number;
  rooms?: string[];
}
