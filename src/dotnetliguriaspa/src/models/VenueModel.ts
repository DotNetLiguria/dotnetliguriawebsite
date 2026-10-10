export interface VenueModel {
  venueId: string;
  name: string;
  coordinates?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  maximumSpaces: number;
}
