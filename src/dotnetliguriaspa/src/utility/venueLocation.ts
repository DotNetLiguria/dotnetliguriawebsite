import type { LocationModel } from '../models/LocationModel';
import type { VenueModel } from '../models/VenueModel';

export function copyVenueLocation(venue: VenueModel): LocationModel {
	return {
		name: venue.name,
		address: venue.address ?? '',
		coordinates: venue.coordinates ?? '',
		googleMapsUrl: venue.googleMapsUrl ?? '',
		maximumSpaces: venue.maximumSpaces,
	};
}
