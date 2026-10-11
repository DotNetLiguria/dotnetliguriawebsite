import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Snackbar, Alert, IconButton, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { LocationModel } from '../../models/LocationModel';
import { VenueModel } from '../../models/VenueModel';
import { copyVenueLocation } from '../../utility/venueLocation';

const AdminWorkshopCreate: FC = () => {
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [eventDate, setEventDate] = useState('');
	const [venues, setVenues] = useState<VenueModel[]>([]);
	const [selectedVenueId, setSelectedVenueId] = useState('');
	const [location, setLocation] = useState<LocationModel>({
		name: '',
		address: '',
		coordinates: '',
		googleMapsUrl: '',
		maximumSpaces: 0,
	});
	const [rooms, setRooms] = useState('');
	const [bookingServiceUrl, setBookingServiceUrl] = useState('');
	const [eventbriteTicketCapacity, setEventbriteTicketCapacity] = useState(0);
	const [attendeeNotes, setAttendeeNotes] = useState('');
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
	const [loading, setLoading] = useState(false);
	const [loadingVenues, setLoadingVenues] = useState(true);

	useEffect(() => {
		const loadVenues = async () => {
			setLoadingVenues(true);
			try {
				const response = await fetch(`${API_BASE_URL}/Venue`);
				if (!response.ok) {
					throw new Error(`Failed to load venues (HTTP ${response.status})`);
				}
				const data: VenueModel[] = await response.json();
				setVenues(data);
			} catch (error) {
				console.error('Error loading venues:', error);
				setSnackbarMessage(error instanceof Error ? error.message : 'Error loading venues');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			} finally {
				setLoadingVenues(false);
			}
		};

		void loadVenues();
	}, [fetch]);

	const handleSubmit = async () => {
		const selectedVenue = venues.find((venue) => venue.venueId === selectedVenueId);
		if (!title || !description || !eventDate || !selectedVenue || !location.name || !location.address) {
			setSnackbarMessage('Please fill in all required fields and select a venue');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
			return;
		}

		const eventRooms = rooms.split(/\r?\n/).map((room) => room.trim()).filter(Boolean);
		setLoading(true);
		try {
			const response = await fetch(`${API_BASE_URL}/Workshop/Post`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					title,
					description,
					eventDate,
					location: {
						...location,
						rooms: eventRooms,
					},
					bookingServiceUrl,
					externalRegistration: Boolean(bookingServiceUrl),
					externalRegistrationLink: bookingServiceUrl,
					eventbriteTicketCapacity,
					attendeeNotes,
				}),
			});

			if (response.ok) {
				const createdWorkshop: unknown = await response.json();
				if (typeof createdWorkshop !== 'object' || createdWorkshop === null) {
					throw new Error('Workshop was created, but the server did not return a valid workshop ID.');
				}
				const workshopRecord = createdWorkshop as Record<string, unknown>;
				const workshopId = workshopRecord.workshopId ?? workshopRecord.WorkshopId;
				if (typeof workshopId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(workshopId)) {
					throw new Error('Workshop was created, but the server did not return a valid workshop ID.');
				}
				navigate(`/admin/workshop/${workshopId}`);
			} else {
				const responseText = await response.text();
				let message = responseText;
				try {
					const problem: unknown = JSON.parse(responseText);
					if (typeof problem === 'object' && problem !== null && 'detail' in problem && typeof problem.detail === 'string') {
						message = problem.detail;
					}
				} catch {
					message = responseText;
				}
				throw new Error(message || `Failed to create workshop (HTTP ${response.status})`);
			}
		} catch (error) {
			console.error('Error creating workshop:', error);
			setSnackbarMessage(error instanceof Error ? error.message : 'Error creating workshop');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		} finally {
			setLoading(false);
		}
	};

	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">
					Create Workshop
				</Typography>
				<IconButton onClick={() => navigate('/admin/workshops')} sx={{ color: 'black' }}>
					<ArrowBackIcon />
				</IconButton>
			</Box>
            <Paper elevation={3} sx={{ p: 3, maxWidth: 800 }}>
				<Grid container spacing={3}>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Title
						</Typography>
						<TextField
							fullWidth
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Enter workshop title"
							sx={{
								'& .MuiOutlinedInput-root': {
									backgroundColor: '#fff',
									'& fieldset': {
										borderColor: 'primary.main',
										borderWidth: 2,
									},
								},
							}}
						/>
					</Grid>
					<Grid size={12}>
						<FormControl fullWidth required>
							<InputLabel id="workshop-venue-label">Venue</InputLabel>
							<Select
								labelId="workshop-venue-label"
								label="Venue"
								value={selectedVenueId}
								onChange={(event) => {
									const venueId = event.target.value;
									setSelectedVenueId(venueId);
									const venue = venues.find((item) => item.venueId === venueId);
									if (venue) {
										setLocation(copyVenueLocation(venue));
									}
								}}
								disabled={loadingVenues || venues.length === 0}
							>
								{venues.map((venue) => (
									<MenuItem key={venue.venueId} value={venue.venueId}>{venue.name}</MenuItem>
								))}
							</Select>
						</FormControl>
						{!loadingVenues && venues.length === 0 && (
							<Typography variant="caption" color="text.secondary">
								Add a venue in Venues / Sale eventi before creating a workshop.
							</Typography>
						)}
					</Grid>
					<Grid size={12}>
						<Typography variant="h6">Location Information</Typography>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Name"
							placeholder="Venue name"
							value={location.name}
							onChange={(event) => setLocation((current) => ({ ...current, name: event.target.value }))}
							required
						/>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Address"
							placeholder="Venue address"
							value={location.address}
							onChange={(event) => setLocation((current) => ({ ...current, address: event.target.value }))}
							required
						/>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Coordinates"
							placeholder="Latitude, longitude"
							value={location.coordinates}
							onChange={(event) => setLocation((current) => ({ ...current, coordinates: event.target.value }))}
						/>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Google Maps URL"
							type="url"
							placeholder="https://maps.google.com/..."
							value={location.googleMapsUrl ?? ''}
							onChange={(event) => setLocation((current) => ({ ...current, googleMapsUrl: event.target.value }))}
						/>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Maximum spaces"
							type="number"
							value={location.maximumSpaces}
							onChange={(event) => setLocation((current) => ({ ...current, maximumSpaces: Number(event.target.value) || 0 }))}
						/>
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							multiline
							minRows={2}
							label="Rooms for this event"
							value={rooms}
							onChange={(event) => setRooms(event.target.value)}
							placeholder="Enter one room per line"
							helperText="Room offerings can differ for each event date."
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Seat booking and cancellation service URL
						</Typography>
						<TextField fullWidth type="url" value={bookingServiceUrl} onChange={(e) => setBookingServiceUrl(e.target.value)} placeholder="https://..." />
					</Grid>
					<Grid size={12}>
						<TextField
							fullWidth
							label="Initial free Eventbrite tickets"
							type="number"
							slotProps={{ htmlInput: { min: 0, step: 1 } }}
							value={eventbriteTicketCapacity}
							onChange={(event) => setEventbriteTicketCapacity(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
							helperText="Separate from the venue's maximum spaces. The Eventbrite draft is created after its agenda is saved."
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Notes for attendees
						</Typography>
						<TextField fullWidth multiline rows={3} value={attendeeNotes} onChange={(e) => setAttendeeNotes(e.target.value)} placeholder="Practical information for attendees" />
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Event Date
						</Typography>
						<TextField
							fullWidth
							type="date"
							value={eventDate}
							onChange={(e) => setEventDate(e.target.value)}
							sx={{
								'& .MuiOutlinedInput-root': {
									backgroundColor: '#fff',
									'& fieldset': {
										borderColor: 'primary.main',
										borderWidth: 2,
									},
								},
							}}
							slotProps={{
                                inputLabel: {
                                    shrink: true,
                                }
                            }}
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Description
						</Typography>
						<TextField
							fullWidth
							multiline
							rows={5}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Enter workshop description"
							sx={{
								'& .MuiOutlinedInput-root': {
									backgroundColor: '#fff',
									'& fieldset': {
										borderColor: 'primary.main',
										borderWidth: 2,
									},
								},
							}}
						/>
					</Grid>
					<Grid size={12}>
						<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
							<Button
								variant="outlined"
								onClick={() => navigate('/admin/workshops')}
								disabled={loading}
							>
								Cancel
							</Button>
							<Button
								variant="contained"
								startIcon={<SaveIcon />}
								onClick={handleSubmit}
								disabled={loading}
								sx={{
									backgroundColor: '#4caf50',
									color: '#fff',
									'&:hover': {
										backgroundColor: '#45a049',
									},
								}}
							>
								{loading ? 'Creating...' : 'Create'}
							</Button>
						</Box>
					</Grid>
				</Grid>
			</Paper>
            <Snackbar
				open={snackbarOpen}
				autoHideDuration={6000}
				onClose={() => setSnackbarOpen(false)}
				anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
			>
				<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
					{snackbarMessage}
				</Alert>
			</Snackbar>
        </Box>
    );
};

export default AdminWorkshopCreate;
