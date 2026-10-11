import React from 'react';
import { fireEvent, makeWorkshop, render, screen, waitFor, within } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminWorkshopAgenda from './AdminWorkshopAgenda';

const jsonResponse = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

describe('<AdminWorkshopAgenda />', () => {
	test('keeps registration, talk pool and per-track schedule pages separate', () => {
		const workshop = makeWorkshop();
		const { rerender } = render(
			<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="registration" />
		);

		expect(screen.getByText('Registration and attendee details')).toBeVisible();
		expect(screen.getByLabelText('Seat booking and cancellation URL')).toBeVisible();
		expect(screen.getByText('Talk pool')).not.toBeVisible();

		rerender(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="talks" />);
		expect(screen.getByText('Talk pool')).toBeVisible();
		expect(screen.getByRole('combobox', { name: 'Import from' })).toHaveTextContent('None');
		expect(screen.getByLabelText('Talk title')).toBeVisible();

		rerender(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);
		expect(screen.getByText('Track schedule')).toBeVisible();
		expect(screen.getByLabelText('Track starting time')).toHaveValue('09:00');
		expect(screen.getByLabelText('Talk duration (minutes)')).toHaveValue(60);
		expect(screen.getByLabelText('Gap duration (minutes)')).toHaveValue(5);
		expect(screen.getByText('Talk pool')).not.toBeVisible();
	}, 10000);

	test('auto-fills every single-track talk with time-only editable slots and technical gaps', async () => {
		const workshop = makeWorkshop({
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			talks: [
				{ workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [] },
				{ workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
			],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		expect(await screen.findByText('First talk')).toBeVisible();
		expect(screen.getByText('Second talk')).toBeVisible();
		expect(screen.getByText('Technical gap')).toBeVisible();
		const starts = screen.getAllByLabelText('Starting time');
		const ends = screen.getAllByLabelText('Ending time');
		expect(starts.map(input => (input as HTMLInputElement).value)).toEqual(['09:00', '10:00', '10:05']);
		expect(ends.map(input => (input as HTMLInputElement).value)).toEqual(['10:00', '10:05', '11:05']);
		expect(screen.queryByLabelText(/date/i)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Save agenda' }));
		await waitFor(() => expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('/Workshop/Update/workshop-1'),
			expect.objectContaining({ method: 'PUT' }),
		));
		const request = vi.mocked(fetch).mock.calls.find(call =>
			String(call[0]).includes('/Workshop/Update/'))?.[1];
		const body = JSON.parse(String(request?.body));
		expect(body.agendaItems).toHaveLength(3);
		expect(body.agendaItems.every((item: { trackId: string }) => item.trackId === 'track-1')).toBe(true);
		expect(body.agendaItems[0].startTime).toMatch(/^2024-03-15T09:00:00/);
	}, 10000);

	test('requires a track for each talk when multiple tracks are available', async () => {
		const workshop = makeWorkshop({
			agendaTracks: [
				{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 },
				{ workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 },
			],
			talks: [{ workshopTalkId: 'talk-1', title: 'Unassigned talk', sessionType: 'talk', speakers: [] }],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="talks" />);

		fireEvent.mouseDown(screen.getAllByRole('combobox').at(-1)!);
		fireEvent.click(screen.getByRole('option', { name: 'Room B' }));
		fireEvent.click(screen.getByRole('button', { name: 'Save talk pool' }));

		await waitFor(() => expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('/Workshop/Update/workshop-1'),
			expect.objectContaining({ method: 'PUT' }),
		));
		const request = vi.mocked(fetch).mock.calls.find(call =>
			String(call[0]).includes('/Workshop/Update/'))?.[1];
		const body = JSON.parse(String(request?.body));
		expect(body.talks[0].trackId).toBe('track-2');
	}, 10000);

	test('moves through one schedule page per track and shows only that track sessions', () => {
		const workshop = makeWorkshop({
			agendaTracks: [
				{ workshopAgendaTrackId: 'track-1', name: 'Room A', order: 0 },
				{ workshopAgendaTrackId: 'track-2', name: 'Room B', order: 1 },
			],
			talks: [
				{ workshopTalkId: 'talk-1', title: 'Room A session', trackId: 'track-1', sessionType: 'talk', speakers: [] },
				{ workshopTalkId: 'talk-2', title: 'Room B session', trackId: 'track-2', sessionType: 'talk', speakers: [] },
			],
			agendaItems: [
				{ workshopAgendaItemId: 'item-1', itemType: 'talk', talkId: 'talk-1', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
				{ workshopAgendaItemId: 'item-2', itemType: 'talk', talkId: 'talk-2', trackId: 'track-2', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' },
			],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		expect(screen.getByText('Room A session')).toBeVisible();
		expect(screen.queryByText('Room B session')).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
		expect(screen.getByText('Room B session')).toBeVisible();
		expect(screen.queryByText('Room A session')).not.toBeInTheDocument();
	}, 10000);

	test('keeps schedule times together before compact room and interval fields', () => {
		const workshop = makeWorkshop({
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			agendaItems: [
				{
					workshopAgendaItemId: 'item-1',
					itemType: 'service',
					title: 'Lunch',
					roomName: 'Dining room',
					trackId: 'track-1',
					startTime: '2024-03-15T12:00:00Z',
					endTime: '2024-03-15T13:00:00Z',
				},
			],
		});
		render(<AdminWorkshopAgenda workshop={workshop} onSaved={() => undefined} activePage="schedule" />);

		const times = screen.getByRole('group', { name: 'Schedule times' });
		expect(within(times).getByLabelText('Starting time')).toHaveValue('12:00');
		expect(within(times).getByLabelText('Ending time')).toHaveValue('13:00');
		expect(screen.getByLabelText('Room name')).toHaveValue('Dining room');
		expect(screen.getByLabelText('Service / interval title')).toHaveValue('Lunch');
		expect(times.compareDocumentPosition(screen.getByLabelText('Room name')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

		const titleAndControls = screen.getByRole('group', { name: 'Schedule item title and controls' });
		expect(within(titleAndControls).getByText('Lunch')).toBeVisible();
		expect(within(titleAndControls).getByRole('button', { name: 'Move item up' })).toBeDisabled();
		expect(within(titleAndControls).getByRole('button', { name: 'Move item down' })).toBeDisabled();
	}, 10000);

	test('sends only the Sessionize ID to the importer', async () => {
		const importedWorkshop = makeWorkshop({
			agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
			talks: [{ workshopTalkId: 'session-1', sessionizeId: 'session-1', title: 'Imported talk', sessionType: 'talk', speakers: [] }],
		});
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		vi.mocked(fetch).mockImplementation(async (input, init) => {
			const url = String(input);
			calls.push({ url, init });
			if (url.includes('/Speaker/Get')) return jsonResponse([]);
			if (url.includes('/Workshop/ImportSessionize/')) return jsonResponse({ importedTalks: 1, importedSpeakers: 0 });
			if (url.includes('/Workshop/Get/')) return jsonResponse(importedWorkshop);
			return jsonResponse({});
		});
		render(<AdminWorkshopAgenda workshop={makeWorkshop()} onSaved={() => undefined} activePage="talks" />);

		fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Import from' }));
		fireEvent.click(screen.getByRole('option', { name: 'Sessionize' }));
		fireEvent.change(screen.getByLabelText('Sessionize ID'), { target: { value: 'event123' } });
		fireEvent.click(screen.getByRole('button', { name: 'Import talks' }));

		await waitFor(() => expect(calls.some(call => call.url.includes('/Workshop/Get/'))).toBe(true));
		const importCall = calls.find(call => call.url.includes('/Workshop/ImportSessionize/'));
		expect(JSON.parse(String(importCall?.init?.body))).toEqual({ sessionizeId: 'event123' });
		expect(await screen.findByText('Sessionize talks imported and matching speaker records updated.')).toBeVisible();
		expect(screen.getByDisplayValue('Imported talk')).toBeVisible();
	});

	test('creates a talk using a speaker selected from the admin speaker directory', async () => {
		const speaker = {
			workshopSpeakerId: 'speaker-1',
			name: 'Ada Lovelace',
			profileImage: '',
			blogHtml: '',
			userName: '',
			email: '',
			description: 'Engineer',
			isActive: true,
		};
		vi.mocked(fetch).mockImplementation(async input =>
			String(input).includes('/Speaker/Get') ? jsonResponse([speaker]) : jsonResponse({}));
		render(<AdminWorkshopAgenda workshop={makeWorkshop()} onSaved={() => undefined} activePage="talks" />);

		fireEvent.change(screen.getByLabelText('Talk title'), { target: { value: 'Analytical Engines' } });
		fireEvent.change(screen.getByLabelText('Speakers'), { target: { value: 'Ada' } });
		fireEvent.click(await screen.findByRole('option', { name: 'Ada Lovelace' }));
		fireEvent.click(screen.getByRole('button', { name: 'Add talk to pool' }));

		expect(screen.getByDisplayValue('Analytical Engines')).toBeVisible();
		expect(screen.getAllByText('Track 1')).toHaveLength(2);
		expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
	});
});
