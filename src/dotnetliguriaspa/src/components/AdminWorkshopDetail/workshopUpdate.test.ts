import { describe, expect, it } from 'vitest';
import { makeWorkshop } from '../../test-utils';
import { buildWorkshopUpdate } from './workshopUpdate';

describe('buildWorkshopUpdate', () => {
	it('updates edited fields while preserving the rest of the workshop data', () => {
		const original = {
			...makeWorkshop({
				location: {
					name: 'Community Hall',
					address: '1 Main Street',
					coordinates: '44.4,8.9',
					googleMapsUrl: 'https://maps.example.test/hall',
					maximumSpaces: 120,
					rooms: ['Auditorium', 'Room B'],
				},
				talks: [{
					workshopTalkId: 'talk-1',
					title: 'Opening',
					sessionType: 'Talk',
					speakers: [],
				}],
			}),
			imageThumbnail: '/workshops/workshop001/workshop_thumb.png',
			feedbackEnabled: true,
			legacyWorkshopField: 'keep me',
		};

		const updated = buildWorkshopUpdate(original, {
			published: true,
			inHomepage: false,
			feedbackEnabled: false,
			title: 'Updated title',
			description: 'Updated description',
			eventDate: '2027-06-21',
			locationName: 'New Hall',
			coordinates: '44.5,9.0',
			address: '2 Main Street',
			googleMapsUrl: 'https://maps.example.test/new-hall',
			maximumSpaces: '150',
		});

		expect(updated).toMatchObject({
			title: 'Updated title',
			description: 'Updated description',
			published: true,
			feedbackEnabled: false,
			imageThumbnail: '/workshops/workshop001/workshop_thumb.png',
			legacyWorkshopField: 'keep me',
			talks: original.talks,
			location: {
				name: 'New Hall',
				address: '2 Main Street',
				coordinates: '44.5,9.0',
				googleMapsUrl: 'https://maps.example.test/new-hall',
				maximumSpaces: 150,
				rooms: ['Auditorium', 'Room B'],
			},
		});
		expect(updated.eventDate.getFullYear()).toBe(2027);
		expect(updated.eventDate.getMonth()).toBe(5);
		expect(updated.eventDate.getDate()).toBe(21);
	});
});
