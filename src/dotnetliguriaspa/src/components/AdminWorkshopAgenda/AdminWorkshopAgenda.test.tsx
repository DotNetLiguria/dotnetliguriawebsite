import React from 'react';
import { fireEvent, makeWorkshop, render, screen, waitFor } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminWorkshopAgenda from './AdminWorkshopAgenda';

describe('<AdminWorkshopAgenda />', () => {
	test('shows registration, talk pool and schedule as separate pages', () => {
		const workshop = makeWorkshop();
		const { rerender } = render(
			<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="registration" />
		);

		expect(screen.getByText('Registration and attendee details')).toBeVisible();
		expect(screen.getByLabelText('Seat booking and cancellation URL')).toBeVisible();
		expect(screen.getByText('Talk pool')).not.toBeVisible();
		expect(screen.getByText('Agenda tracks and schedule')).not.toBeVisible();

		rerender(
			<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="talks" />
		);
		expect(screen.getByText('Talk pool')).toBeVisible();
		expect(screen.getByLabelText('Talk title')).toBeVisible();
		expect(screen.getByText('Agenda tracks and schedule')).not.toBeVisible();

		rerender(
			<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />
		);
		expect(screen.getByText('Agenda tracks and schedule')).toBeVisible();
		expect(screen.getByLabelText('Number of tracks')).toBeVisible();
		expect(screen.getByText('Talk pool')).not.toBeVisible();
	});

	test('represents a single agenda without creating a track record', async () => {
		const workshop = makeWorkshop({
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			agendaItems: [{
				workshopAgendaItemId: 'item-1',
				itemType: 'talk',
				talkId: 'talk-1',
				trackId: 'track-1',
				startTime: '2027-06-21T10:00:00Z',
				endTime: '2027-06-21T11:00:00Z',
			}],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		expect(screen.getByLabelText('Number of tracks')).toHaveValue(1);
		expect(screen.queryByLabelText('Track 1 name')).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Save event and agenda' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		const request = vi.mocked(fetch).mock.calls[0][1];
		const body = JSON.parse(String(request?.body));
		expect(body.agendaTracks).toEqual([]);
		expect(body.agendaItems[0].trackId).toBeNull();
	});

	test('prevents overlapping talks on a single agenda', async () => {
		const workshop = makeWorkshop({
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			talks: [
				{ workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [] },
				{ workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
			],
			agendaItems: [
				{
					workshopAgendaItemId: 'item-1',
					itemType: 'talk',
					talkId: 'talk-1',
					trackId: 'track-1',
					startTime: '2027-06-21T10:00:00Z',
					endTime: '2027-06-21T11:00:00Z',
				},
				{
					workshopAgendaItemId: 'item-2',
					itemType: 'talk',
					talkId: 'talk-2',
					trackId: 'track-1',
					startTime: '2027-06-21T10:30:00Z',
					endTime: '2027-06-21T11:30:00Z',
				},
			],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		fireEvent.click(screen.getByRole('button', { name: 'Save event and agenda' }));

		expect(await screen.findByText('Agenda items cannot overlap in the same track, room, or event-wide break, or schedule a speaker twice.')).toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	test('allows overlapping talks on separate tracks', async () => {
		const workshop = makeWorkshop({
			agendaTracks: [
				{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 },
				{ workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 },
			],
			talks: [
				{ workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [] },
				{ workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
			],
			agendaItems: [
				{
					workshopAgendaItemId: 'item-1',
					itemType: 'talk',
					talkId: 'talk-1',
					trackId: 'track-1',
					roomName: 'Room A',
					startTime: '2027-06-21T10:00:00Z',
					endTime: '2027-06-21T11:00:00Z',
				},
				{
					workshopAgendaItemId: 'item-2',
					itemType: 'talk',
					talkId: 'talk-2',
					trackId: 'track-2',
					roomName: 'Room B',
					startTime: '2027-06-21T10:00:00Z',
					endTime: '2027-06-21T11:00:00Z',
				},
			],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		expect(screen.getByLabelText('Track 1 name')).toHaveValue('Room A');
		expect(screen.getByLabelText('Track 2 name')).toHaveValue('Room B');
		fireEvent.click(screen.getByRole('button', { name: 'Save event and agenda' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
	});
});
