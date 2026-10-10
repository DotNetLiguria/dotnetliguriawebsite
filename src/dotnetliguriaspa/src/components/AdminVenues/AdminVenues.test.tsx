import React from 'react';
import { fireEvent, render, screen, waitFor } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminVenues from './AdminVenues';

describe('<AdminVenues />', () => {
	test('creates a reusable venue in the venue collection', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(new Response('[]', {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}));
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
			venueId: 'venue-1',
			name: 'Community Hall',
			address: '1 Main Street',
			coordinates: '44.4,8.9',
			googleMapsUrl: 'https://maps.google.com/?q=Community+Hall',
			maximumSpaces: 120,
		}), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		}));
		render(<AdminVenues />);

		fireEvent.click(await screen.findByRole('button', { name: 'Add venue' }));
		await screen.findByRole('heading', { name: 'Add venue' });
		fireEvent.change(await screen.findByPlaceholderText('Venue name'), { target: { value: 'Community Hall' } });
		fireEvent.change(screen.getByPlaceholderText('Venue address'), { target: { value: '1 Main Street' } });
		fireEvent.change(screen.getByPlaceholderText('Latitude, longitude'), { target: { value: '44.4,8.9' } });
		fireEvent.change(screen.getByPlaceholderText('https://maps.google.com/...'), { target: { value: 'https://maps.google.com/?q=Community+Hall' } });
		fireEvent.change(screen.getByLabelText('Maximum spaces'), { target: { value: '120' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
		const request = vi.mocked(fetch).mock.calls[1][1];
		expect(JSON.parse(String(request?.body))).toMatchObject({
			name: 'Community Hall',
			address: '1 Main Street',
			coordinates: '44.4,8.9',
			maximumSpaces: 120,
		});
		expect(await screen.findByText('Community Hall')).toBeInTheDocument();
	});
});
