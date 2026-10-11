import React, { FC, useCallback, useEffect, useState } from 'react';
import {
	Alert,
	Autocomplete,
	Box,
	Button,
	Card,
	CardContent,
	Divider,
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Snackbar,
	TextField,
	Typography,
} from '@mui/material';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import { SpeakerModel } from '../../models/SpeakerModel';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
	WorkshopAgendaItemModel,
	WorkshopAgendaTrackModel,
	WorkshopModel,
	WorkshopTalkModel,
} from '../../models/WorkshopModel';

interface AdminWorkshopAgendaProps {
	workshop: WorkshopModel;
	onSaved: (workshop: WorkshopModel) => void;
	activePage: 'registration' | 'talks' | 'schedule';
}

const createId = () => crypto.randomUUID();
const toClockTime = (value?: Date | string) => {
	if (!value) return '';
	const date = new Date(value);
	const pad = (part: number) => part.toString().padStart(2, '0');
	return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};
const toStoredTime = (clockTime: string, existingValue: Date | string | undefined, eventDate: Date | string | undefined) => {
	const datePart = existingValue
		? new Date(existingValue).toISOString().slice(0, 10)
		: eventDate
			? new Date(eventDate).toISOString().slice(0, 10)
			: '2000-01-01';
	return `${datePart}T${clockTime}:00.000Z`;
};
const itemOrder = (first: WorkshopAgendaItemModel, second: WorkshopAgendaItemModel) =>
	(first.order ?? Number.MAX_SAFE_INTEGER) - (second.order ?? Number.MAX_SAFE_INTEGER) ||
	new Date(first.startTime).getTime() - new Date(second.startTime).getTime();

const AdminWorkshopAgenda: FC<AdminWorkshopAgendaProps> = ({ workshop, onSaved, activePage }) => {
	const { fetch } = useOidcFetch();
	const [talks, setTalks] = useState<WorkshopTalkModel[]>([]);
	const [tracks, setTracks] = useState<WorkshopAgendaTrackModel[]>([]);
	const [items, setItems] = useState<WorkshopAgendaItemModel[]>([]);
	const [speakers, setSpeakers] = useState<SpeakerModel[]>([]);
	const [bookingServiceUrl, setBookingServiceUrl] = useState('');
	const [eventbriteTicketCapacity, setEventbriteTicketCapacity] = useState(0);
	const [eventbriteSalesStart, setEventbriteSalesStart] = useState('');
	const [eventbriteSalesEnd, setEventbriteSalesEnd] = useState('');
	const [eventbriteSales, setEventbriteSales] = useState<{
		totalCapacity: number;
		sold: number;
		pending: number;
		remaining: number;
		refreshedAt: string;
	} | null>(null);
	const [refreshingEventbriteSales, setRefreshingEventbriteSales] = useState(false);
	const [syncingEventbrite, setSyncingEventbrite] = useState(false);
	const [publishingEventbrite, setPublishingEventbrite] = useState(false);
	const [attendeeNotes, setAttendeeNotes] = useState('');
	const [importSource, setImportSource] = useState<'none' | 'sessionize'>('none');
	const [sessionizeId, setSessionizeId] = useState('');
	const [talkTitle, setTalkTitle] = useState('');
	const [talkAbstract, setTalkAbstract] = useState('');
	const [talkType, setTalkType] = useState('talk');
	const [selectedTalkSpeakers, setSelectedTalkSpeakers] = useState<SpeakerModel[]>([]);
	const [talkTrackId, setTalkTrackId] = useState('');
	const [trackIndex, setTrackIndex] = useState(0);
	const [scheduleStart, setScheduleStart] = useState('09:00');
	const [talkDuration, setTalkDuration] = useState('60');
	const [gapDuration, setGapDuration] = useState('5');
	const [intervalTitle, setIntervalTitle] = useState('Lunch');
	const [itemRoom, setItemRoom] = useState('');
	const [message, setMessage] = useState('');
	const [error, setError] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const initialTracks = workshop.agendaTracks?.length
			? workshop.agendaTracks
			: [{ workshopAgendaTrackId: createId(), name: 'Track 1', order: 0 }];
		const trackIds = new Set(initialTracks.map(track => track.workshopAgendaTrackId));
		const defaultTrackId = initialTracks[0].workshopAgendaTrackId;
		const sourceItems = workshop.agendaItems ?? [];
		const initialTalks = (workshop.talks ?? []).map(talk => {
			const agendaTrackId = sourceItems.find(item => item.talkId === talk.workshopTalkId)?.trackId;
			const assignedTrackId = talk.trackId && trackIds.has(talk.trackId)
				? talk.trackId
				: agendaTrackId && trackIds.has(agendaTrackId) ? agendaTrackId : null;
			return { ...talk, trackId: initialTracks.length === 1 ? defaultTrackId : assignedTrackId };
		});
		const initialItems = sourceItems.map(item => ({
			...item,
			trackId: initialTracks.length === 1
				? defaultTrackId
				: workshop.talks?.find(talk => talk.workshopTalkId === item.talkId)?.trackId ?? item.trackId,
		}));
		const orderedInitialItems = initialItems.sort(itemOrder).map((item, order) => ({ ...item, order }));
		setTalks(initialTalks);
		setTracks(initialTracks);
		setTrackIndex(0);
		setTalkTrackId(initialTracks.length === 1 ? defaultTrackId : '');
		setItems(orderedInitialItems);
		if (orderedInitialItems.length > 0) setScheduleStart(toClockTime(orderedInitialItems[0].startTime));
		setBookingServiceUrl(workshop.bookingServiceUrl ??
			(workshop.eventbriteEventId ? '' : workshop.externalRegistrationLink ?? ''));
		setEventbriteTicketCapacity(workshop.eventbriteTicketCapacity ?? 0);
		setEventbriteSalesStart(workshop.eventbriteSalesStart ?? '');
		setEventbriteSalesEnd(workshop.eventbriteSalesEnd ?? '');
		setEventbriteSales(null);
		setAttendeeNotes(workshop.attendeeNotes ?? '');
	}, [workshop]);

	useEffect(() => {
		let active = true;
		const loadSpeakers = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/Speaker/Get?onlyActive=true`);
				if (!response.ok) throw new Error(`Failed to load speakers (HTTP ${response.status})`);
				const data: SpeakerModel[] = await response.json();
				if (active) setSpeakers(data);
			} catch (exception) {
				if (active) {
					setMessage(exception instanceof Error ? exception.message : 'Failed to load speakers');
					setError(true);
				}
			}
		};
		void loadSpeakers();
		return () => { active = false; };
	}, [fetch]);

	const reportError = async (response: Response, fallback: string) => {
		const responseText = await response.text();
		let detail = responseText;
		try {
			const body: unknown = JSON.parse(responseText);
			if (typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string') {
				detail = body.detail;
			}
		} catch {
			detail = responseText;
		}
		throw new Error(detail || `${fallback} (HTTP ${response.status})`);
	};

	const handleImport = async () => {
		if (importSource === 'none') return;
		setBusy(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Workshop/ImportSessionize/${workshop.workshopId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionizeId: sessionizeId.trim() }),
			});
			if (!response.ok) await reportError(response, 'Sessionize import failed');
			const refreshed = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
			if (!refreshed.ok) await reportError(refreshed, 'Could not reload imported talks');
			const updatedWorkshop: WorkshopModel = await refreshed.json();
			const nextTalks = (updatedWorkshop.talks ?? []).map(talk => ({
				...talk,
				trackId: tracks.length === 1 ? tracks[0].workshopAgendaTrackId : talk.trackId ?? null,
			}));
			setTalks(nextTalks);
			const speakerResponse = await fetch(`${API_BASE_URL}/Speaker/Get?onlyActive=true`);
			if (!speakerResponse.ok) await reportError(speakerResponse, 'Could not reload imported speakers');
			setSpeakers(await speakerResponse.json());
			setMessage('Sessionize talks imported and matching speaker records updated.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Sessionize import failed');
			setError(true);
		} finally {
			setBusy(false);
		}
	};

	const handleAddTalk = () => {
		if (!talkTitle.trim()) {
			setMessage('Enter a talk title.');
			setError(true);
			return;
		}
		if (selectedTalkSpeakers.length === 0) {
			setMessage('Select at least one speaker from the Speaker directory.');
			setError(true);
			return;
		}
		if (tracks.length > 1 && !talkTrackId) {
			setMessage('Select a track for this talk.');
			setError(true);
			return;
		}
		setTalks(current => [...current, {
			workshopTalkId: createId(),
			trackId: tracks.length === 1 ? tracks[0].workshopAgendaTrackId : talkTrackId || null,
			title: talkTitle.trim(),
			abstract: talkAbstract,
			sessionType: talkType,
			speakers: selectedTalkSpeakers.map(speaker => ({
				workshopSpeakerId: speaker.workshopSpeakerId,
				name: speaker.name,
				imageUrl: speaker.profileImage,
				biography: speaker.description,
			})),
		}]);
		setTalkTitle('');
		setTalkAbstract('');
		setSelectedTalkSpeakers([]);
		setMessage('Talk added to the workshop pool. Save the talk pool to persist it.');
		setError(false);
	};

	const handleTrackCount = (count: number) => {
		const safeCount = Math.max(1, Math.trunc(count));
		const next = tracks.slice(0, safeCount);
		while (next.length < safeCount) {
			next.push({ workshopAgendaTrackId: createId(), name: `Track ${next.length + 1}`, order: next.length });
		}
		const orderedTracks = next.map((track, order) => ({ ...track, order }));
		const validIds = new Set(orderedTracks.map(track => track.workshopAgendaTrackId));
		const fallbackId = orderedTracks[0].workshopAgendaTrackId;
		setTracks(orderedTracks);
		setTalks(current => current.map(talk => validIds.has(talk.trackId ?? '') ? talk : { ...talk, trackId: fallbackId }));
		setItems(current => current.map(item => validIds.has(item.trackId ?? '') ? item : { ...item, trackId: fallbackId }));
		setTalkTrackId(orderedTracks.length === 1 ? fallbackId : '');
		setTrackIndex(current => Math.min(current, orderedTracks.length - 1));
	};

	const handleAutoFillSchedule = useCallback(() => {
		const duration = Number(talkDuration);
		const gap = Number(gapDuration);
		const [startHour, startMinute] = scheduleStart.split(':').map(Number);
		if (!Number.isFinite(startHour) || !Number.isFinite(startMinute) ||
			!Number.isInteger(duration) || duration < 1 || !Number.isInteger(gap) || gap < 1) {
			setMessage('Enter a valid start time and positive session and gap durations.');
			setError(true);
			return;
		}
		if (activePage !== 'registration' && talks.some(talk => !talk.trackId || !tracks.some(track => track.workshopAgendaTrackId === talk.trackId))) {
			setMessage('Assign each talk to a track before generating the schedule.');
			setError(true);
			return;
		}

		const nextItems: WorkshopAgendaItemModel[] = [];
		const startAt = startHour * 60 + startMinute;
		const dateForSchedule = workshop.eventDate
			? new Date(workshop.eventDate).toISOString().slice(0, 10)
			: '2000-01-01';
		const clockAt = (minutes: number) => {
			const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
			return `${Math.floor(normalized / 60).toString().padStart(2, '0')}:${(normalized % 60).toString().padStart(2, '0')}`;
		};

		tracks.forEach(track => {
			const trackItems = items.filter(item => item.trackId === track.workshopAgendaTrackId).sort(itemOrder);
			const existingTalkItems = new Map(trackItems.filter(item => item.itemType === 'talk' && item.talkId)
				.map(item => [item.talkId as string, item]));
			const oldTechnicalGaps = new Set(trackItems.filter(item =>
				item.itemType === 'break' && item.title === 'Technical gap').map(item => item.workshopAgendaItemId));
			const sequence: Array<{ kind: 'talk'; talk: WorkshopTalkModel; item?: WorkshopAgendaItemModel } | { kind: 'interval'; item: WorkshopAgendaItemModel }> = [];
			const seenTalkIds = new Set<string>();
			for (const item of trackItems) {
				if (oldTechnicalGaps.has(item.workshopAgendaItemId)) continue;
				if (item.itemType === 'talk' && item.talkId) {
					const talk = talks.find(value => value.workshopTalkId === item.talkId);
					if (talk && !seenTalkIds.has(talk.workshopTalkId)) {
						sequence.push({ kind: 'talk', talk, item });
						seenTalkIds.add(talk.workshopTalkId);
					}
				} else {
					sequence.push({ kind: 'interval', item });
				}
			}
			for (const talk of talks) {
				if (talk.trackId === track.workshopAgendaTrackId && !seenTalkIds.has(talk.workshopTalkId)) {
					sequence.push({ kind: 'talk', talk, item: existingTalkItems.get(talk.workshopTalkId) });
				}
			}

			let cursor = startAt;
			let talkCount = sequence.filter(entry => entry.kind === 'talk').length;
			for (const entry of sequence) {
				if (entry.kind === 'talk') {
					const start = clockAt(cursor);
					const end = clockAt(cursor + duration);
					nextItems.push({
						...(entry.item ?? {}),
						workshopAgendaItemId: entry.item?.workshopAgendaItemId ?? createId(),
						itemType: 'talk',
						talkId: entry.talk.workshopTalkId,
						trackId: track.workshopAgendaTrackId,
						startTime: `${dateForSchedule}T${start}:00.000Z`,
						endTime: `${dateForSchedule}T${end}:00.000Z`,
						order: nextItems.filter(item => item.trackId === track.workshopAgendaTrackId).length,
					});
					cursor += duration;
					talkCount -= 1;
					if (talkCount > 0) {
						const gapStart = clockAt(cursor);
						const gapEnd = clockAt(cursor + gap);
						nextItems.push({
							workshopAgendaItemId: createId(),
							itemType: 'break',
							trackId: track.workshopAgendaTrackId,
							title: 'Technical gap',
							startTime: `${dateForSchedule}T${gapStart}:00.000Z`,
							endTime: `${dateForSchedule}T${gapEnd}:00.000Z`,
							order: nextItems.filter(item => item.trackId === track.workshopAgendaTrackId).length,
						});
						cursor += gap;
					}
				} else {
					const intervalDuration = Math.max(1, Math.round(
						(new Date(entry.item.endTime).getTime() - new Date(entry.item.startTime).getTime()) / 60000,
					) || gap);
					const intervalStart = clockAt(cursor);
					const intervalEnd = clockAt(cursor + intervalDuration);
					nextItems.push({
						...entry.item,
						trackId: track.workshopAgendaTrackId,
						startTime: `${dateForSchedule}T${intervalStart}:00.000Z`,
						endTime: `${dateForSchedule}T${intervalEnd}:00.000Z`,
						order: nextItems.filter(item => item.trackId === track.workshopAgendaTrackId).length,
					});
					cursor += intervalDuration;
				}
			}
		});
		setItems(nextItems);
		setMessage('Track schedules filled from the selected start time and durations. Adjust any session or interval below.');
		setError(false);
	}, [activePage, gapDuration, items, scheduleStart, talkDuration, talks, tracks, workshop.eventDate]);

	useEffect(() => {
		const hasUnscheduledTalk = talks.some(talk =>
			!items.some(item => item.itemType === 'talk' && item.talkId === talk.workshopTalkId));
		if (activePage === 'schedule' && talks.length > 0 && hasUnscheduledTalk) {
			handleAutoFillSchedule();
		}
	}, [activePage, handleAutoFillSchedule, items, talks]);

	const handleAddServiceInterval = () => {
		const track = tracks[trackIndex];
		if (!track) return;
		const trackItems = items.filter(item => item.trackId === track.workshopAgendaTrackId).sort(itemOrder);
		const previousEnd = trackItems.length > 0
			? new Date(trackItems[trackItems.length - 1].endTime)
			: new Date(toStoredTime(scheduleStart, undefined, workshop.eventDate));
		const duration = Math.max(1, Number(gapDuration) || 5);
		const startTime = new Date(previousEnd);
		const endTime = new Date(startTime.getTime() + duration * 60000);
		const newItem: WorkshopAgendaItemModel = {
			workshopAgendaItemId: createId(),
			itemType: 'service',
			trackId: track.workshopAgendaTrackId,
			title: intervalTitle.trim() || 'Service interval',
			roomName: itemRoom,
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			order: trackItems.length,
		};
		setItems(current => [...current, newItem]);
		setIntervalTitle('Lunch');
		setItemRoom('');
		setMessage('Service interval added. Adjust its time and position in the track schedule.');
		setError(false);
	};

	const handleRemoveTalk = (talkId: string) => {
		setTalks(current => current.filter(item => item.workshopTalkId !== talkId));
		setItems(current => current.filter(item => item.talkId !== talkId));
	};

	const updateItem = (itemId: string, update: Partial<WorkshopAgendaItemModel>) => {
		setItems(current => current.map(item => item.workshopAgendaItemId === itemId ? { ...item, ...update } : item));
	};

	const assignTalkTrack = (talkId: string, trackId: string) => {
		setTalks(current => current.map(talk =>
			talk.workshopTalkId === talkId ? { ...talk, trackId: trackId || null } : talk));
		setItems(current => current.map(item =>
			item.talkId === talkId ? { ...item, trackId: trackId || null } : item));
	};

	const moveItem = (itemId: string, direction: -1 | 1) => {
		const track = tracks[trackIndex];
		if (!track) return;
		setItems(current => {
			const trackItems = current.filter(item => item.trackId === track.workshopAgendaTrackId).sort(itemOrder);
			const index = trackItems.findIndex(item => item.workshopAgendaItemId === itemId);
			const nextIndex = index + direction;
			if (index < 0 || nextIndex < 0 || nextIndex >= trackItems.length) return current;
			const updated = [...trackItems];
			const first = updated[index];
			const second = updated[nextIndex];
			updated[index] = { ...second, startTime: first.startTime, endTime: first.endTime, order: index };
			updated[nextIndex] = { ...first, startTime: second.startTime, endTime: second.endTime, order: nextIndex };
			const changedById = new Map(updated.map(item => [item.workshopAgendaItemId, item]));
			return current.map(item => changedById.get(item.workshopAgendaItemId) ?? item);
		});
	};

	const handleSave = async () => {
		if (eventbriteSalesStart && eventbriteSalesEnd && eventbriteSalesStart >= eventbriteSalesEnd) {
			setMessage('Eventbrite ticket sales must end after they start.');
			setError(true);
			return false;
		}
		if (activePage !== 'registration' && items.some(item => item.itemType === 'talk' &&
			(!item.trackId || !tracks.some(track => track.workshopAgendaTrackId === item.trackId)))) {
			setMessage('Assign each talk to a track before saving the agenda.');
			setError(true);
			return false;
		}
		if (talks.some(talk => !talk.trackId || !tracks.some(track => track.workshopAgendaTrackId === talk.trackId))) {
			setMessage('Assign each talk to a track before saving the agenda.');
			setError(true);
			return false;
		}
		for (const item of activePage === 'registration' ? [] : items) {
			const start = new Date(item.startTime).getTime();
			const end = new Date(item.endTime).getTime();
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
				setMessage('Each agenda item must have a valid ending time after its start time.');
				setError(true);
				return false;
			}
		}
		for (let firstIndex = 0; activePage !== 'registration' && firstIndex < items.length; firstIndex += 1) {
			for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
				const first = items[firstIndex];
				const second = items[secondIndex];
				const overlaps = new Date(first.startTime) < new Date(second.endTime) &&
					new Date(second.startTime) < new Date(first.endTime);
				const sharesTrack = Boolean(first.trackId && first.trackId === second.trackId);
				const eventWide = !first.trackId || !second.trackId;
				const firstRoom = first.roomName?.trim().toLocaleLowerCase();
				const sharesRoom = Boolean(firstRoom && firstRoom === second.roomName?.trim().toLocaleLowerCase());
				const firstTalk = talks.find(talk => talk.workshopTalkId === first.talkId);
				const secondTalk = talks.find(talk => talk.workshopTalkId === second.talkId);
				const firstSpeakers = new Set(firstTalk?.speakers.map(speaker =>
					speaker.workshopSpeakerId ?? speaker.sessionizeId ?? speaker.name.trim().toLocaleLowerCase()) ?? []);
				const sharesSpeaker = secondTalk?.speakers.some(speaker =>
					firstSpeakers.has(speaker.workshopSpeakerId ?? speaker.sessionizeId ?? speaker.name.trim().toLocaleLowerCase())) ?? false;
				if (overlaps && (sharesTrack || eventWide || sharesRoom || sharesSpeaker)) {
					setMessage('Agenda items cannot overlap in the same track, room, or event-wide break, or schedule a speaker twice.');
					setError(true);
					return false;
				}
			}
		}
		const updatedWorkshop: WorkshopModel = {
			...workshop,
			bookingServiceUrl,
			eventbriteTicketCapacity,
			eventbriteSalesStart,
			eventbriteSalesEnd,
			externalRegistration: Boolean(bookingServiceUrl),
			externalRegistrationLink: bookingServiceUrl,
			attendeeNotes,
			talks,
			agendaTracks: tracks,
			agendaItems: items,
		};
		setBusy(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedWorkshop),
			});
			if (!response.ok) await reportError(response, 'Could not save workshop agenda');
			onSaved({
				...updatedWorkshop,
				eventbriteSyncStatus: workshop.eventbriteEventId ? 'update-pending' : workshop.eventbriteSyncStatus,
				eventbriteLastError: undefined,
			});
			setMessage('Workshop details and agenda saved.');
			setError(false);
			return true;
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Could not save workshop agenda');
			setError(true);
			return false;
		} finally {
			setBusy(false);
		}
	};

	const handleSetEventbriteCapacity = async () => {
		setBusy(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Eventbrite/SetTicketCapacity/${workshop.workshopId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ capacity: eventbriteTicketCapacity }),
			});
			if (!response.ok) await reportError(response, 'Could not update Eventbrite ticket availability');
			const updatedWorkshop: WorkshopModel = await response.json();
			onSaved(updatedWorkshop);
			setMessage('Ticket capacity saved locally. Use Sync/Update Eventbrite to apply it.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Could not update Eventbrite ticket availability');
			setError(true);
		} finally {
			setBusy(false);
		}
	};

	const handleRefreshEventbriteSales = async () => {
		setRefreshingEventbriteSales(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Eventbrite/TicketSales/${workshop.workshopId}`);
			if (!response.ok) await reportError(response, 'Could not refresh Eventbrite ticket sales');
			setEventbriteSales(await response.json());
			setMessage('Live Eventbrite ticket sales refreshed.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Could not refresh Eventbrite ticket sales');
			setError(true);
		} finally {
			setRefreshingEventbriteSales(false);
		}
	};

	const handleSyncEventbrite = async () => {
		setSyncingEventbrite(true);
		try {
			if (!await handleSave()) return;
			const response = await fetch(`${API_BASE_URL}/Eventbrite/Sync/${workshop.workshopId}`, { method: 'POST' });
			if (!response.ok) await reportError(response, 'Eventbrite synchronization failed');
			const updatedWorkshop: WorkshopModel = await response.json();
			onSaved(updatedWorkshop);
			setMessage(updatedWorkshop.eventbriteEventId
				? 'Eventbrite event synchronized.'
				: 'Workshop saved. Add its location, agenda, and initial ticket quantity before Eventbrite can create a draft.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Eventbrite synchronization failed');
			setError(true);
		} finally {
			setSyncingEventbrite(false);
		}
	};

	const handlePublishEventbrite = async () => {
		if (!window.confirm('Publish this event on Eventbrite? This is separate from publishing the workshop on this website.')) return;
		setPublishingEventbrite(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Eventbrite/Publish/${workshop.workshopId}`, { method: 'POST' });
			if (!response.ok) await reportError(response, 'Eventbrite publishing failed');
			const refreshed = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
			if (refreshed.ok) onSaved(await refreshed.json());
			setMessage('Event published on Eventbrite.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Eventbrite publishing failed');
			setError(true);
		} finally {
			setPublishingEventbrite(false);
		}
	};

	const readinessIssues = [
		!workshop.title?.trim() && 'Workshop title',
		!workshop.description?.trim() && 'Workshop description',
		!workshop.eventDate && 'Event date',
		!workshop.location?.name?.trim() && 'Location name',
		!workshop.location?.address?.trim() && 'Location address',
		eventbriteTicketCapacity <= 0 && 'Positive free-ticket capacity',
		tracks.length === 0 && 'At least one agenda track',
		items.length === 0 && 'At least one scheduled agenda item',
		items.some(item => !Number.isFinite(new Date(item.startTime).getTime()) ||
			!Number.isFinite(new Date(item.endTime).getTime()) ||
			new Date(item.endTime) <= new Date(item.startTime)) && 'Valid start and end times for each agenda item',
		eventbriteSalesStart && eventbriteSalesEnd && eventbriteSalesStart >= eventbriteSalesEnd &&
			'Sales end time later than sales start time',
	].filter((issue): issue is string => Boolean(issue));

	return (
		<Box sx={{ display: 'grid', gap: 3, mt: 4 }}>
			<Paper sx={{ p: 3, display: activePage === 'registration' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Registration and attendee details</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Save workshop and agenda changes locally first. Eventbrite is changed only when you select Sync/Update below.
				</Typography>
				{readinessIssues.length > 0 && (
					<Alert severity="info" sx={{ mb: 2 }}>
						<Typography variant="subtitle2">Required before Eventbrite can be synchronized</Typography>
						<ul style={{ margin: '4px 0 0', paddingLeft: 22 }}>
							{readinessIssues.map(issue => <li key={issue}>{issue}</li>)}
						</ul>
					</Alert>
				)}
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { sm: '1fr 1fr' } }}>
					<TextField label="Seat booking and cancellation URL" value={bookingServiceUrl} onChange={event => setBookingServiceUrl(event.target.value)} />
					<TextField
						label="Available free Eventbrite tickets"
						type="number"
						slotProps={{ htmlInput: { min: Math.max(workshop.eventbriteSyncedTicketCapacity ?? 0, (eventbriteSales?.sold ?? 0) + (eventbriteSales?.pending ?? 0)), step: 1 } }}
						value={eventbriteTicketCapacity}
						onChange={event => setEventbriteTicketCapacity(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
						helperText={`Separate from venue capacity. Increase this value to release more tickets; currently synchronized total: ${workshop.eventbriteSyncedTicketCapacity ?? 0}.`}
					/>
					<TextField
						label="Eventbrite ticket sales start"
						type="datetime-local"
						value={eventbriteSalesStart}
						onChange={event => setEventbriteSalesStart(event.target.value)}
						helperText="Optional; interpreted in the configured Eventbrite timezone."
						slotProps={{ inputLabel: { shrink: true } }}
					/>
					<TextField
						label="Eventbrite ticket sales end"
						type="datetime-local"
						value={eventbriteSalesEnd}
						onChange={event => setEventbriteSalesEnd(event.target.value)}
						helperText="Optional; interpreted in the configured Eventbrite timezone."
						slotProps={{ inputLabel: { shrink: true } }}
					/>
					<TextField label="Attendee notes" multiline minRows={2} value={attendeeNotes} onChange={event => setAttendeeNotes(event.target.value)} sx={{ gridColumn: { sm: '1 / -1' } }} />
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 2 }}>
					<Typography variant="body2">
						Eventbrite status: {workshop.eventbriteSyncStatus ?? 'Not created'}
						{workshop.eventbriteLastSyncedAt ? ` · Last synced ${new Date(workshop.eventbriteLastSyncedAt).toLocaleString()}` : ''}
					</Typography>
					{workshop.eventbriteEventUrl && (
						<Button component="a" href={workshop.eventbriteEventUrl} target="_blank" rel="noreferrer">
							Open Eventbrite event
						</Button>
					)}
					{workshop.eventbriteEventId && (
						<Button variant="outlined" onClick={() => void handleRefreshEventbriteSales()} disabled={refreshingEventbriteSales || busy}>
							{refreshingEventbriteSales ? 'Refreshing ticket sales…' : 'Refresh live ticket sales'}
						</Button>
					)}
					{eventbriteSales && (
						<Alert severity="info" sx={{ width: '100%' }}>
							Eventbrite tickets — sold: {eventbriteSales.sold}, pending: {eventbriteSales.pending},
							{' '}total capacity: {eventbriteSales.totalCapacity}, remaining: {eventbriteSales.remaining}.
							{' '}Refreshed {new Date(eventbriteSales.refreshedAt).toLocaleString()}.
						</Alert>
					)}
					<Button variant="contained" onClick={() => void handleSave()} disabled={busy || syncingEventbrite}>
						Save registration and agenda
					</Button>
					{workshop.eventbriteEventId &&
						eventbriteTicketCapacity > (workshop.eventbriteSyncedTicketCapacity ?? 0) && (
							<Button variant="outlined" onClick={() => void handleSetEventbriteCapacity()} disabled={busy}>
								Save ticket capacity
							</Button>
						)}
					<Button variant="outlined" onClick={() => void handleSyncEventbrite()} disabled={busy || syncingEventbrite || readinessIssues.length > 0}>
						{syncingEventbrite ? 'Syncing…' : workshop.eventbriteEventId ? 'Sync/Update Eventbrite' : 'Create Eventbrite draft'}
					</Button>
					{workshop.eventbriteEventId && !workshop.eventbritePublished && (
						<Button variant="contained" color="warning" onClick={() => void handlePublishEventbrite()} disabled={busy || publishingEventbrite}>
							{publishingEventbrite ? 'Publishing…' : 'Publish on Eventbrite'}
						</Button>
					)}
					{workshop.eventbritePublished && <Typography color="success.main">Published on Eventbrite</Typography>}
					{workshop.eventbriteLastError && <Alert severity="error" sx={{ width: '100%' }}>{workshop.eventbriteLastError}</Alert>}
				</Box>
			</Paper>

			<Paper sx={{ p: 3, display: activePage === 'talks' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Talk pool</Typography>
				<Typography variant="h6" sx={{ mb: 2 }}>Import talks</Typography>
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr 2fr auto' }, alignItems: 'start' }}>
					<FormControl fullWidth>
						<InputLabel id="talk-import-source-label">Import from</InputLabel>
						<Select
							labelId="talk-import-source-label"
							label="Import from"
							value={importSource}
							onChange={event => setImportSource(event.target.value as 'none' | 'sessionize')}
						>
							<MenuItem value="none">None</MenuItem>
							<MenuItem value="sessionize">Sessionize</MenuItem>
						</Select>
					</FormControl>
					{importSource === 'sessionize' && (
						<TextField
							fullWidth
							label="Sessionize ID"
							placeholder="Event ID"
							value={sessionizeId}
							onChange={event => setSessionizeId(event.target.value)}
						/>
					)}
					{importSource === 'sessionize' && (
						<Button variant="outlined" onClick={() => void handleImport()} disabled={busy || !sessionizeId.trim()}>
							Import talks
						</Button>
					)}
				</Box>
				<Divider sx={{ my: 3 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>Tracks</Typography>
				<TextField
					type="number"
					label="Number of tracks"
					value={tracks.length}
					onChange={event => handleTrackCount(Number(event.target.value) || 1)}
					slotProps={{ htmlInput: { min: 1 } }}
					sx={{ mb: 2 }}
				/>
				<Box sx={{ display: 'grid', gap: 1, mb: 3 }}>
					{tracks.map((track, index) => (
						<TextField
							key={track.workshopAgendaTrackId}
							label={`Track ${index + 1} name`}
							value={track.name}
							onChange={event => setTracks(current => current.map(value =>
								value.workshopAgendaTrackId === track.workshopAgendaTrackId
									? { ...value, name: event.target.value }
									: value))}
						/>
					))}
				</Box>
				<Divider sx={{ my: 3 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>Create a talk</Typography>
				<Box sx={{ display: 'grid', gap: 2 }}>
					<TextField label="Talk title" value={talkTitle} onChange={event => setTalkTitle(event.target.value)} />
					<TextField label="Abstract" multiline minRows={2} value={talkAbstract} onChange={event => setTalkAbstract(event.target.value)} />
					<TextField select label="Session type" value={talkType} onChange={event => setTalkType(event.target.value)}>
						<MenuItem value="talk">Talk</MenuItem>
						<MenuItem value="panel">Panel</MenuItem>
						<MenuItem value="intro">Introduction</MenuItem>
						<MenuItem value="other">Other</MenuItem>
					</TextField>
					<Autocomplete
						multiple
						options={speakers}
						value={selectedTalkSpeakers}
						getOptionLabel={option => option.name}
						isOptionEqualToValue={(option, value) => option.workshopSpeakerId === value.workshopSpeakerId}
						onChange={(_, value) => setSelectedTalkSpeakers(value)}
						renderInput={params => <TextField {...params} label="Speakers" placeholder="Select one or more speakers" />}
					/>
					{tracks.length > 1 && (
						<TextField
							select
							label="Track"
							value={talkTrackId}
							onChange={event => setTalkTrackId(event.target.value)}
						>
							{tracks.map(track => (
								<MenuItem key={track.workshopAgendaTrackId} value={track.workshopAgendaTrackId}>{track.name}</MenuItem>
							))}
						</TextField>
					)}
					{tracks.length === 1 && <Typography color="text.secondary">Talks are assigned to {tracks[0].name} automatically.</Typography>}
					<Button variant="outlined" onClick={handleAddTalk}>Add talk to pool</Button>
				</Box>
				<Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Talks in the pool</Typography>
				<Box sx={{ display: 'grid', gap: 1 }}>
					{talks.map(talk => (
						<Card key={talk.workshopTalkId} variant="outlined">
							<CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr auto' } }}>
								<Box sx={{ display: 'grid', gap: 1 }}>
									<TextField label="Talk title" value={talk.title} onChange={event => setTalks(current => current.map(value => value.workshopTalkId === talk.workshopTalkId ? { ...value, title: event.target.value } : value))} />
									<TextField label="Abstract" multiline minRows={2} value={talk.abstract ?? ''} onChange={event => setTalks(current => current.map(value => value.workshopTalkId === talk.workshopTalkId ? { ...value, abstract: event.target.value } : value))} />
									<TextField select label="Session type" value={talk.sessionType} onChange={event => setTalks(current => current.map(value => value.workshopTalkId === talk.workshopTalkId ? { ...value, sessionType: event.target.value } : value))}>
										<MenuItem value="talk">Talk</MenuItem>
										<MenuItem value="panel">Panel</MenuItem>
										<MenuItem value="intro">Introduction</MenuItem>
										<MenuItem value="service">Service</MenuItem>
										<MenuItem value="other">Other</MenuItem>
									</TextField>
									<Autocomplete
										multiple
										options={speakers}
										value={talk.speakers.flatMap(talkSpeaker => {
											const speaker = speakers.find(value =>
												value.workshopSpeakerId === talkSpeaker.workshopSpeakerId ||
												(!talkSpeaker.workshopSpeakerId && value.name === talkSpeaker.name));
											return speaker ? [speaker] : [];
										})}
										getOptionLabel={option => option.name}
										isOptionEqualToValue={(option, value) => option.workshopSpeakerId === value.workshopSpeakerId}
										onChange={(_, value) => setTalks(current => current.map(item =>
											item.workshopTalkId === talk.workshopTalkId
												? {
													...item,
													speakers: value.map(speaker => ({
														workshopSpeakerId: speaker.workshopSpeakerId,
														name: speaker.name,
														imageUrl: speaker.profileImage,
														biography: speaker.description,
													})),
												}
												: item))}
										renderInput={params => <TextField {...params} label="Speakers" placeholder="Select one or more speakers" />}
									/>
									{tracks.length > 1 ? (
										<TextField
											select
											label="Track"
											value={talk.trackId ?? ''}
											onChange={event => assignTalkTrack(talk.workshopTalkId, event.target.value)}
										>
											<MenuItem value="">Select a track</MenuItem>
											{tracks.map(track => (
												<MenuItem key={track.workshopAgendaTrackId} value={track.workshopAgendaTrackId}>{track.name}</MenuItem>
											))}
										</TextField>
									) : <Typography color="text.secondary">{tracks[0]?.name ?? 'Track 1'}</Typography>}
								</Box>
								<Button color="error" onClick={() => handleRemoveTalk(talk.workshopTalkId)}>Remove</Button>
							</CardContent>
						</Card>
					))}
				</Box>
				<Button variant="contained" onClick={() => void handleSave()} disabled={busy} sx={{ mt: 3 }}>Save talk pool</Button>
			</Paper>

			<Paper sx={{ p: 3, display: activePage === 'schedule' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Track schedule</Typography>
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { sm: 'repeat(3, 1fr)' }, mb: 2 }}>
					<TextField label="Track starting time" type="time" value={scheduleStart} onChange={event => setScheduleStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
					<TextField label="Talk duration (minutes)" type="number" value={talkDuration} onChange={event => setTalkDuration(event.target.value)} slotProps={{ htmlInput: { min: 1 } }} />
					<TextField label="Gap duration (minutes)" type="number" value={gapDuration} onChange={event => setGapDuration(event.target.value)} slotProps={{ htmlInput: { min: 1 } }} />
				</Box>
				<Button variant="outlined" onClick={handleAutoFillSchedule} sx={{ mb: 3 }}>Auto-fill track schedules</Button>
				{tracks.length > 1 && (
					<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
						<Button disabled={trackIndex === 0} onClick={() => setTrackIndex(index => Math.max(0, index - 1))}>Previous track</Button>
						<Typography variant="h6">{tracks[trackIndex]?.name} ({trackIndex + 1} of {tracks.length})</Typography>
						<Button disabled={trackIndex >= tracks.length - 1} onClick={() => setTrackIndex(index => Math.min(tracks.length - 1, index + 1))}>Next track</Button>
					</Box>
				)}
				{tracks.length === 1 && <Typography variant="h6" sx={{ mb: 2 }}>{tracks[0].name}</Typography>}
				<Box sx={{ display: 'grid', gap: 2 }}>
					{items.filter(item => item.trackId === tracks[trackIndex]?.workshopAgendaTrackId).sort(itemOrder).map((item, index, trackItems) => {
						const talk = talks.find(value => value.workshopTalkId === item.talkId);
						const itemTitle = talk?.title ?? item.title ?? item.itemType;
						return (
							<Card key={item.workshopAgendaItemId} variant="outlined">
								<CardContent sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
									<Box role="group" aria-label="Schedule item title and controls" sx={{ gridColumn: '1 / -1', display: 'flex', gap: 1, alignItems: 'center', minWidth: 0 }}>
										<Typography variant="h6" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{itemTitle}</Typography>
										<Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto', flexShrink: 0 }}>
											<IconButton aria-label="Move item up" disabled={index === 0} onClick={() => moveItem(item.workshopAgendaItemId, -1)}><KeyboardArrowUpIcon /></IconButton>
											<IconButton aria-label="Move item down" disabled={index === trackItems.length - 1} onClick={() => moveItem(item.workshopAgendaItemId, 1)}><KeyboardArrowDownIcon /></IconButton>
											{item.itemType !== 'talk' && <Button color="error" onClick={() => setItems(current => current.filter(value => value.workshopAgendaItemId !== item.workshopAgendaItemId))}>Remove interval</Button>}
										</Box>
									</Box>
									<Box role="group" aria-label="Schedule times" sx={{ gridColumn: 'span 2', display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', minWidth: 0 }}>
										<TextField label="Starting time" type="time" value={toClockTime(item.startTime)} onChange={event => updateItem(item.workshopAgendaItemId, { startTime: toStoredTime(event.target.value, item.startTime, workshop.eventDate) })} slotProps={{ inputLabel: { shrink: true } }} />
										<TextField label="Ending time" type="time" value={toClockTime(item.endTime)} onChange={event => updateItem(item.workshopAgendaItemId, { endTime: toStoredTime(event.target.value, item.endTime, workshop.eventDate) })} slotProps={{ inputLabel: { shrink: true } }} />
									</Box>
									<TextField label="Room name" value={item.roomName ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { roomName: event.target.value })} />
									{item.itemType !== 'talk' && <TextField label="Service / interval title" value={item.title ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { title: event.target.value })} />}
								</CardContent>
							</Card>
						);
					})}
				</Box>
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { sm: '2fr 1fr auto' }, mt: 3, alignItems: 'center' }}>
					<TextField label="Service interval title" value={intervalTitle} onChange={event => setIntervalTitle(event.target.value)} />
					<TextField label="Room (optional)" value={itemRoom} onChange={event => setItemRoom(event.target.value)} />
					<Button variant="outlined" onClick={handleAddServiceInterval}>Add service interval</Button>
				</Box>
				<Button variant="contained" onClick={() => void handleSave()} disabled={busy} sx={{ mt: 3 }}>Save agenda</Button>
			</Paper>
			<Snackbar open={Boolean(message)} autoHideDuration={6000} onClose={() => setMessage('')}>
				<Alert severity={error ? 'error' : 'success'} onClose={() => setMessage('')}>{message}</Alert>
			</Snackbar>
		</Box>
	);
};

export default AdminWorkshopAgenda;
