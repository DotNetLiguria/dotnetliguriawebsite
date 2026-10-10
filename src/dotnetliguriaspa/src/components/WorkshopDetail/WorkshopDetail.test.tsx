import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { render, makeWorkshop, screen } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import { getWorkshopById } from '../../services/workShopService';
import WorkshopDetail from './WorkshopDetail';

vi.mock('../../services/workShopService', () => ({
	getWorkshopById: vi.fn(),
}));

describe('<WorkshopDetail /> agenda and event details', () => {
	test('shows agenda, speaker image, venue map, booking link and attendee notes', async () => {
		vi.mocked(getWorkshopById).mockResolvedValue(makeWorkshop({
			tracks: [],
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			talks: [{
				workshopTalkId: 'talk-1',
				title: 'Building useful tools',
				abstract: 'An overview of tool design.',
				sessionType: 'panel',
				speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace', imageUrl: 'https://images.example.test/ada.jpg' }],
			}],
			agendaItems: [{
				workshopAgendaItemId: 'agenda-1',
				itemType: 'talk',
				talkId: 'talk-1',
				trackId: 'track-1',
				roomName: 'Room A',
				startTime: '2024-03-15T10:00:00Z',
				endTime: '2024-03-15T11:00:00Z',
			}],
			location: {
				name: 'Genova',
				address: 'Via del Porto 1',
				coordinates: '44.4056,8.9463',
				googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Genova',
				maximumSpaces: 150,
			},
			bookingServiceUrl: 'https://booking.example.test/event/1',
			attendeeNotes: 'Bring your laptop.',
		}));

		render(
			<Routes>
				<Route path="/workshop/:id" element={<WorkshopDetail />} />
			</Routes>,
			{ route: '/workshop/workshop-1' },
		);

		expect(await screen.findByRole('heading', { name: 'Building useful tools' })).toBeInTheDocument();
		expect(screen.getByText('An overview of tool design.')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute('src', 'https://images.example.test/ada.jpg');
		expect(screen.getByText(/Main stage/)).toBeInTheDocument();
		expect(screen.getByText('Bring your laptop.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Book or cancel a seat' })).toHaveAttribute('href', 'https://booking.example.test/event/1');
		expect(screen.getByRole('link', { name: 'Open map' })).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Genova');
		expect(screen.getByTitle('Workshop Location')).toHaveAttribute('src', expect.stringContaining('maps.google.com/maps'));
	});
});
