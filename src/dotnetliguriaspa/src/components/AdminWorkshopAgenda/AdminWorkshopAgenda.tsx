import React, { FC, useEffect, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	FormControl,
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
const toDateTimeInput = (value?: Date | string) => {
	if (!value) return '';
	const date = new Date(value);
	const pad = (part: number) => part.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const parseSpeakerLines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
	const [name, imageUrl, ...biography] = line.split('|').map(part => part.trim());
	return { name, imageUrl, biography: biography.join('|') || undefined };
});

const AdminWorkshopAgenda: FC<AdminWorkshopAgendaProps> = ({ workshop, onSaved, activePage }) => {
	const { fetch } = useOidcFetch();
	const [talks, setTalks] = useState<WorkshopTalkModel[]>([]);
	const [tracks, setTracks] = useState<WorkshopAgendaTrackModel[]>([]);
	const [items, setItems] = useState<WorkshopAgendaItemModel[]>([]);
	const [bookingServiceUrl, setBookingServiceUrl] = useState('');
	const [attendeeNotes, setAttendeeNotes] = useState('');
	const [importUrl, setImportUrl] = useState('');
	const [talkTitle, setTalkTitle] = useState('');
	const [talkAbstract, setTalkAbstract] = useState('');
	const [talkType, setTalkType] = useState('talk');
	const [speakerLines, setSpeakerLines] = useState('');
	const [itemType, setItemType] = useState<'talk' | 'break' | 'service'>('talk');
	const [itemTalkId, setItemTalkId] = useState('');
	const [itemTrackId, setItemTrackId] = useState('');
	const [itemTitle, setItemTitle] = useState('');
	const [itemRoom, setItemRoom] = useState('');
	const [itemStart, setItemStart] = useState('');
	const [itemEnd, setItemEnd] = useState('');
	const [message, setMessage] = useState('');
	const [error, setError] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setTalks(workshop.talks ?? []);
		const initialTracks = workshop.agendaTracks ?? [];
		const multipleTracks = initialTracks.length > 1;
		setTracks(multipleTracks ? initialTracks : []);
		setItemTrackId(multipleTracks ? initialTracks[0].workshopAgendaTrackId : '');
		setItems((workshop.agendaItems ?? []).map(item => multipleTracks ? item : { ...item, trackId: null }));
		setBookingServiceUrl(workshop.bookingServiceUrl ?? workshop.externalRegistrationLink ?? '');
		setAttendeeNotes(workshop.attendeeNotes ?? '');
	}, [workshop]);

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
		setBusy(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Workshop/ImportSessionize/${workshop.workshopId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: importUrl }),
			});
			if (!response.ok) await reportError(response, 'Sessionize import failed');
			const refreshed = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
			if (!refreshed.ok) await reportError(refreshed, 'Could not reload imported talks');
			const updatedWorkshop: WorkshopModel = await refreshed.json();
			setTalks(updatedWorkshop.talks ?? []);
			onSaved(updatedWorkshop);
			setMessage('Sessionize talks and speakers imported.');
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

		const speakers = parseSpeakerLines(speakerLines);
		if (speakers.length === 0 || speakers.some(speaker => !speaker.name)) {
			setMessage('Enter at least one speaker name. You can add a picture URL on the same line.');
			setError(true);
			return;
		}
		setTalks(current => [...current, {
			workshopTalkId: createId(),
			title: talkTitle.trim(),
			abstract: talkAbstract,
			sessionType: talkType,
			speakers,
		}]);
		setTalkTitle('');
		setTalkAbstract('');
		setSpeakerLines('');
		setMessage('Talk added to the workshop pool. Save the agenda to persist it.');
		setError(false);
	};

	const handleTrackCount = (count: number) => {
		const safeCount = Math.max(1, Math.trunc(count));
		if (safeCount < tracks.length) {
			const removedIds = new Set(tracks.slice(safeCount === 1 ? 1 : safeCount).map(track => track.workshopAgendaTrackId));
			if (items.some(item => item.trackId && removedIds.has(item.trackId))) {
				setMessage('Move agenda items from the tracks being removed before reducing the track count.');
				setError(true);
				return;
			}
		}
		if (safeCount === 1) {
			setTracks([]);
			setItemTrackId('');
			setItems(current => current.map(item => ({ ...item, trackId: null })));
			return;
		}
		const next = tracks.slice(0, safeCount);
		while (next.length < safeCount) {
			next.push({ workshopAgendaTrackId: createId(), name: `Track ${next.length + 1}`, order: next.length });
		}
		const orderedTracks = next.map((track, order) => ({ ...track, order }));
		setTracks(orderedTracks);
		setItemTrackId(current => orderedTracks.some(track => track.workshopAgendaTrackId === current)
			? current
			: orderedTracks[0]?.workshopAgendaTrackId ?? '');
	};

	const handleAddAgendaItem = () => {
		if (!itemStart || !itemEnd || new Date(itemEnd) <= new Date(itemStart)) {
			setMessage('Enter a valid start and end time.');
			setError(true);
			return;
		}
		if (itemType === 'talk' && !itemTalkId) {
			setMessage('Select a talk for this agenda item.');
			setError(true);
			return;
		}
		if (itemType === 'talk' && tracks.length > 1 && !itemTrackId) {
			setMessage('Select a track for this talk.');
			setError(true);
			return;
		}
		const selectedTalk = talks.find(talk => talk.workshopTalkId === itemTalkId);
		if (itemType === 'talk' && selectedTalk?.sessionType !== 'service' && !selectedTalk?.speakers.length) {
			setMessage('Add at least one named speaker to the talk before scheduling it.');
			setError(true);
			return;
		}
		const item: WorkshopAgendaItemModel = {
			workshopAgendaItemId: createId(),
			itemType,
			talkId: itemType === 'talk' ? itemTalkId : null,
			trackId: tracks.length > 1 ? itemTrackId || null : null,
			title: itemType === 'talk' ? undefined : itemTitle,
			roomName: itemRoom,
			startTime: new Date(itemStart).toISOString(),
			endTime: new Date(itemEnd).toISOString(),
		};
		setItems(current => [...current, item].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
		setItemTitle('');
		setItemRoom('');
		setMessage('Agenda item added. Save the agenda to persist it.');
		setError(false);
	};

	const handleRemoveTalk = (talkId: string) => {
		if (items.some(item => item.talkId === talkId)) {
			setMessage('Remove this talk from the agenda before deleting it from the talk pool.');
			setError(true);
			return;
		}
		setTalks(current => current.filter(item => item.workshopTalkId !== talkId));
	};

	const updateItem = (itemId: string, update: Partial<WorkshopAgendaItemModel>) => {
		setItems(current => current.map(item => item.workshopAgendaItemId === itemId ? { ...item, ...update } : item));
	};

	const handleSave = async () => {
		if (tracks.length > 1 && items.some(item => item.itemType === 'talk' &&
			(!item.trackId || !tracks.some(track => track.workshopAgendaTrackId === item.trackId)))) {
			setMessage('Assign each talk to a track before saving the agenda.');
			setError(true);
			return;
		}
		for (const item of items) {
			const start = new Date(item.startTime).getTime();
			const end = new Date(item.endTime).getTime();
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
				setMessage('Each agenda item must have a valid ending time after its start time.');
				setError(true);
				return;
			}
		}
		for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
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
					return;
				}
			}
		}
		const updatedWorkshop: WorkshopModel = {
			...workshop,
			bookingServiceUrl,
			externalRegistration: Boolean(bookingServiceUrl),
			externalRegistrationLink: bookingServiceUrl,
			attendeeNotes,
			talks,
			agendaTracks: tracks,
			agendaItems: tracks.length > 1 ? items : items.map(item => ({ ...item, trackId: null })),
		};
		setBusy(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedWorkshop),
			});
			if (!response.ok) await reportError(response, 'Could not save workshop agenda');
			onSaved(updatedWorkshop);
			setMessage('Workshop details and agenda saved.');
			setError(false);
		} catch (exception) {
			setMessage(exception instanceof Error ? exception.message : 'Could not save workshop agenda');
			setError(true);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Box sx={{ display: 'grid', gap: 3, mt: 4 }}>
			<Paper sx={{ p: 3, display: activePage === 'registration' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Registration and attendee details</Typography>
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { sm: '1fr 1fr' } }}>
					<TextField label="Seat booking and cancellation URL" value={bookingServiceUrl} onChange={event => setBookingServiceUrl(event.target.value)} />
					<TextField label="Attendee notes" multiline minRows={2} value={attendeeNotes} onChange={event => setAttendeeNotes(event.target.value)} sx={{ gridColumn: { sm: '1 / -1' } }} />
				</Box>
			</Paper>

			<Paper sx={{ p: 3, display: activePage === 'talks' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Talk pool</Typography>
				<Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
					<TextField fullWidth label="Sessionize All URL" placeholder="https://sessionize.com/api/v2/{id}/view/All" value={importUrl} onChange={event => setImportUrl(event.target.value)} />
					<Button variant="outlined" onClick={handleImport} disabled={busy || !importUrl.trim()}>Import</Button>
				</Box>
				<Box sx={{ display: 'grid', gap: 2 }}>
					<TextField label="Talk title" value={talkTitle} onChange={event => setTalkTitle(event.target.value)} />
					<TextField label="Abstract" multiline minRows={2} value={talkAbstract} onChange={event => setTalkAbstract(event.target.value)} />
					<TextField select label="Session type" value={talkType} onChange={event => setTalkType(event.target.value)}>
						<MenuItem value="talk">Talk</MenuItem>
						<MenuItem value="panel">Panel</MenuItem>
						<MenuItem value="intro">Introduction</MenuItem>
						<MenuItem value="other">Other</MenuItem>
					</TextField>
					<TextField label="Speakers (one per line: name | image URL | biography)" multiline minRows={2} value={speakerLines} onChange={event => setSpeakerLines(event.target.value)} />
					<Button variant="outlined" onClick={handleAddTalk}>Add talk</Button>
				</Box>
				<Box sx={{ display: 'grid', gap: 1, mt: 2 }}>
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
									<TextField label="Speakers (one per line: name | image URL | biography)" multiline minRows={2} value={talk.speakers.map(speaker => [speaker.name, speaker.imageUrl ?? '', speaker.biography ?? ''].join(' | ')).join('\n')} onChange={event => setTalks(current => current.map(value => value.workshopTalkId === talk.workshopTalkId ? { ...value, speakers: parseSpeakerLines(event.target.value) } : value))} />
								</Box>
								<Button color="error" onClick={() => handleRemoveTalk(talk.workshopTalkId)}>Remove</Button>
							</CardContent>
						</Card>
					))}
				</Box>
			</Paper>

			<Paper sx={{ p: 3, display: activePage === 'schedule' ? 'block' : 'none' }}>
				<Typography variant="h5" sx={{ mb: 2 }}>Agenda tracks and schedule</Typography>
				<TextField type="number" label="Number of tracks" value={Math.max(1, tracks.length)} onChange={event => handleTrackCount(Number(event.target.value) || 1)} slotProps={{ htmlInput: { min: 1 } }} sx={{ mb: 2 }} />
				<Box sx={{ display: 'grid', gap: 1, mb: 3 }}>
					{tracks.map((track, index) => (
						<TextField key={track.workshopAgendaTrackId} label={`Track ${index + 1} name`} value={track.name} onChange={event => setTracks(current => current.map(value => value.workshopAgendaTrackId === track.workshopAgendaTrackId ? { ...value, name: event.target.value } : value))} />
					))}
				</Box>
				<Typography variant="h6" sx={{ mb: 2 }}>Add agenda item</Typography>
				<Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: 'repeat(2, 1fr)' } }}>
					<FormControl>
						<InputLabel>Item type</InputLabel>
						<Select value={itemType} label="Item type" onChange={event => setItemType(event.target.value as 'talk' | 'break' | 'service')}>
							<MenuItem value="talk">Talk</MenuItem>
							<MenuItem value="break">Interval</MenuItem>
							<MenuItem value="service">Service / lunch</MenuItem>
						</Select>
					</FormControl>
					{itemType === 'talk' ? (
						<TextField select label="Talk" value={itemTalkId} onChange={event => setItemTalkId(event.target.value)}>
							{talks.map(talk => <MenuItem key={talk.workshopTalkId} value={talk.workshopTalkId}>{talk.title}</MenuItem>)}
						</TextField>
					) : <TextField label="Break or service title" value={itemTitle} onChange={event => setItemTitle(event.target.value)} />}
					{tracks.length > 1 && (
						<TextField select label={itemType === 'talk' ? 'Track' : 'Track (all tracks if not selected)'} value={itemTrackId} onChange={event => setItemTrackId(event.target.value)}>
							{itemType !== 'talk' && <MenuItem value="">All tracks / event-wide</MenuItem>}
							{tracks.map(track => <MenuItem key={track.workshopAgendaTrackId} value={track.workshopAgendaTrackId}>{track.name}</MenuItem>)}
						</TextField>
					)}
					<TextField label="Room name (optional)" value={itemRoom} onChange={event => setItemRoom(event.target.value)} />
					<TextField label="Starting time" type="datetime-local" value={itemStart} onChange={event => setItemStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
					<TextField label="Ending time" type="datetime-local" value={itemEnd} onChange={event => setItemEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
					<Button variant="outlined" onClick={handleAddAgendaItem} sx={{ gridColumn: { md: '1 / -1' } }}>Add to agenda</Button>
				</Box>
				<Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
					{items.map(item => {
						const talk = talks.find(value => value.workshopTalkId === item.talkId);
						return (
							<Card key={item.workshopAgendaItemId} variant="outlined">
								<CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: 'repeat(2, 1fr)' } }}>
									<Typography variant="h6" sx={{ gridColumn: { md: '1 / -1' } }}>{talk?.title ?? item.title ?? item.itemType}</Typography>
									{item.itemType === 'talk' && (
										<TextField select label="Talk" value={item.talkId ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { talkId: event.target.value })}>
											{talks.map(value => <MenuItem key={value.workshopTalkId} value={value.workshopTalkId}>{value.title}</MenuItem>)}
										</TextField>
									)}
									{tracks.length > 1 && (
										<TextField select label={item.itemType === 'talk' ? 'Track' : 'Track (all tracks if not selected)'} value={item.trackId ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { trackId: event.target.value || null })}>
											{item.itemType !== 'talk' && <MenuItem value="">All tracks / event-wide</MenuItem>}
											{tracks.map(track => <MenuItem key={track.workshopAgendaTrackId} value={track.workshopAgendaTrackId}>{track.name}</MenuItem>)}
										</TextField>
									)}
									<TextField label="Room name" value={item.roomName ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { roomName: event.target.value })} />
									{item.itemType !== 'talk' && <TextField label="Break or service title" value={item.title ?? ''} onChange={event => updateItem(item.workshopAgendaItemId, { title: event.target.value })} />}
									<TextField label="Starting time" type="datetime-local" value={toDateTimeInput(item.startTime)} onChange={event => updateItem(item.workshopAgendaItemId, { startTime: event.target.value ? new Date(event.target.value).toISOString() : '' })} slotProps={{ inputLabel: { shrink: true } }} />
									<TextField label="Ending time" type="datetime-local" value={toDateTimeInput(item.endTime)} onChange={event => updateItem(item.workshopAgendaItemId, { endTime: event.target.value ? new Date(event.target.value).toISOString() : '' })} slotProps={{ inputLabel: { shrink: true } }} />
									<Button color="error" onClick={() => setItems(current => current.filter(value => value.workshopAgendaItemId !== item.workshopAgendaItemId))}>Remove item</Button>
								</CardContent>
							</Card>
						);
					})}
				</Box>
				<Button variant="contained" onClick={handleSave} disabled={busy} sx={{ mt: 3 }}>Save event and agenda</Button>
			</Paper>
			<Snackbar open={Boolean(message)} autoHideDuration={6000} onClose={() => setMessage('')}>
				<Alert severity={error ? 'error' : 'success'} onClose={() => setMessage('')}>{message}</Alert>
			</Snackbar>
		</Box>
	);
};

export default AdminWorkshopAgenda;
