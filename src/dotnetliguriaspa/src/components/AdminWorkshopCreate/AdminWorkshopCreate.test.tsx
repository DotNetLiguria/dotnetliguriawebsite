import React from 'react';
import { fireEvent, render, screen, waitFor } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { useLocation } from 'react-router-dom';
import AdminWorkshopCreate from './AdminWorkshopCreate';

const CurrentPath = () => <span data-testid="current-path">{useLocation().pathname}</span>;

describe('<AdminWorkshopCreate />', () => {
	test('creates an event with a copied venue snapshot, event rooms, booking and attendee details', async () => {
		const user = userEvent.setup();
		const selectedVenue = {
			venueId: 'venue-1',
			name: 'Community Hall',
			address: '1 Main Street',
			coordinates: '44.4,8.9',
			googleMapsUrl: 'https://maps.google.com/?q=Community+Hall',
			maximumSpaces: 120,
		};
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([selectedVenue]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}));
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ workshopId: '00112233-4455-6677-8899-aabbccddeeff' }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		}));
		render(<><AdminWorkshopCreate /><CurrentPath /></>);

		fireEvent.change(screen.getByPlaceholderText('Enter workshop title'), { target: { value: 'Agenda Day' } });
		fireEvent.change(screen.getByPlaceholderText('Enter workshop description'), { target: { value: 'Community event' } });
		fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2027-06-21' } });
		await waitFor(() => expect(screen.getByRole('combobox', { name: 'Venue' })).not.toBeDisabled());
		await user.click(screen.getByRole('combobox', { name: 'Venue' }));
		await user.click(await screen.findByRole('option', { name: 'Community Hall' }));
		expect(screen.getByPlaceholderText('Venue name')).toHaveValue('Community Hall');
		expect(screen.getByPlaceholderText('Venue address')).toHaveValue('1 Main Street');
		expect(screen.getByPlaceholderText('Latitude, longitude')).toHaveValue('44.4,8.9');
		expect(screen.getByPlaceholderText('https://maps.google.com/...')).toHaveValue('https://maps.google.com/?q=Community+Hall');
		expect(screen.getByLabelText('Maximum spaces')).toHaveValue(120);
		fireEvent.change(screen.getByPlaceholderText('Venue name'), { target: { value: 'Updated Hall' } });
		fireEvent.change(screen.getByPlaceholderText('Venue address'), { target: { value: '2 Main Street' } });
		fireEvent.change(screen.getByPlaceholderText('Latitude, longitude'), { target: { value: '44.5,9.0' } });
		fireEvent.change(screen.getByPlaceholderText('https://maps.google.com/...'), { target: { value: 'https://maps.google.com/?q=Updated+Hall' } });
		fireEvent.change(screen.getByLabelText('Maximum spaces'), { target: { value: '150' } });
		fireEvent.change(screen.getByLabelText('Rooms for this event'), { target: { value: 'Auditorium\nRoom B' } });
		fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://booking.example.test/event/1' } });
		fireEvent.change(screen.getByPlaceholderText('Practical information for attendees'), { target: { value: 'Bring your laptop' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/workshop/00112233-4455-6677-8899-aabbccddeeff'));
		const request = vi.mocked(fetch).mock.calls[1][1];
		const body = JSON.parse(String(request?.body));
		expect(body).toMatchObject({
			title: 'Agenda Day',
			description: 'Community event',
			eventDate: '2027-06-21',
			location: {
				name: 'Updated Hall',
				address: '2 Main Street',
				coordinates: '44.5,9.0',
				googleMapsUrl: 'https://maps.google.com/?q=Updated+Hall',
				maximumSpaces: 150,
				rooms: ['Auditorium', 'Room B'],
			},
			bookingServiceUrl: 'https://booking.example.test/event/1',
			attendeeNotes: 'Bring your laptop',
		});
	});

	test('shows the API error detail when workshop creation fails', async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([{
			venueId: 'venue-1',
			name: 'Community Hall',
			address: '1 Main Street',
			coordinates: '44.4,8.9',
			googleMapsUrl: '',
			maximumSpaces: 120,
		}]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}));
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Workshop counter unavailable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/problem+json' },
		}));
		render(<AdminWorkshopCreate />);

		fireEvent.change(screen.getByPlaceholderText('Enter workshop title'), { target: { value: 'Agenda Day' } });
		fireEvent.change(screen.getByPlaceholderText('Enter workshop description'), { target: { value: 'Community event' } });
		fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2027-06-21' } });
		await waitFor(() => expect(screen.getByRole('combobox', { name: 'Venue' })).not.toBeDisabled());
		await user.click(screen.getByRole('combobox', { name: 'Venue' }));
		await user.click(await screen.findByRole('option', { name: 'Community Hall' }));
		fireEvent.click(screen.getByRole('button', { name: 'Create' }));

		expect(await screen.findByText('Workshop counter unavailable')).toBeInTheDocument();
	});

	test('does not navigate to an undefined workshop when the create response omits its ID', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([{
			venueId: 'venue-1',
			name: 'Community Hall',
			address: '1 Main Street',
			coordinates: '44.4,8.9',
			googleMapsUrl: '',
			maximumSpaces: 120,
		}]), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}));
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({}), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		}));
		render(<><AdminWorkshopCreate /><CurrentPath /></>);

		fireEvent.change(screen.getByPlaceholderText('Enter workshop title'), { target: { value: 'Agenda Day' } });
		fireEvent.change(screen.getByPlaceholderText('Enter workshop description'), { target: { value: 'Community event' } });
		fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2027-06-21' } });
		await waitFor(() => expect(screen.getByRole('combobox', { name: 'Venue' })).not.toBeDisabled());
		const user = userEvent.setup();
		await user.click(screen.getByRole('combobox', { name: 'Venue' }));
		await user.click(await screen.findByRole('option', { name: 'Community Hall' }));
		fireEvent.click(screen.getByRole('button', { name: 'Create' }));

		expect(await screen.findByText('Workshop was created, but the server did not return a valid workshop ID.')).toBeInTheDocument();
		expect(screen.getByTestId('current-path')).toHaveTextContent('/');
	});
});
