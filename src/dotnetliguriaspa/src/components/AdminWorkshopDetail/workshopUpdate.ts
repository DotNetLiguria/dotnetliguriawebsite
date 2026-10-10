import type { WorkshopModel } from '../../models/WorkshopModel';

export function buildWorkshopUpdate(
	workshop: WorkshopModel,
	values: {
		published: boolean;
		inHomepage: boolean;
		feedbackEnabled: boolean;
		title: string;
		description: string;
		eventDate: string;
		locationName: string;
		coordinates: string;
		address: string;
		googleMapsUrl: string;
		maximumSpaces: string;
	},
): WorkshopModel & { feedbackEnabled: boolean } {
	return {
		...workshop,
		published: values.published,
		in_homepage: values.inHomepage,
		feedbackEnabled: values.feedbackEnabled,
		title: values.title,
		eventDate: values.eventDate ? new Date(`${values.eventDate}T12:00:00`) : workshop.eventDate,
		description: values.description,
		location: {
			...workshop.location,
			name: values.locationName,
			coordinates: values.coordinates,
			address: values.address,
			googleMapsUrl: values.googleMapsUrl,
			maximumSpaces: Number.parseInt(values.maximumSpaces, 10) || 0,
		},
	};
}
