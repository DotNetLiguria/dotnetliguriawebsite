import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, IconButton, Button, Snackbar, Alert, CircularProgress, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, Switch, FormControlLabel, Fab, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import { useParams, useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL, CONTENT_BASE_URL } from '../../config/apiConfig';
import { WorkshopModel } from '../../models/WorkshopModel';
import { TrackModel } from '../../models/TrackModel';
import { SpeakerModel } from '../../models/SpeakerModel';
import { WorkshopFileModel } from '../../models/WorkshopFileModel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface AdminWorkshopDetailProps {
	pageName?: string;
}

const AdminWorkshopDetail: FC<AdminWorkshopDetailProps> = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const [loading, setLoading] = useState<boolean>(true);
	const [workshop, setWorkshop] = useState<WorkshopModel | null>(null);
	const [published, setPublished] = useState<boolean>(false);
	const [inHomepage, setInHomepage] = useState<boolean>(false);
	const [feedbackEnabled, setFeedbackEnabled] = useState<boolean>(false);
	const [locationName, setLocationName] = useState<string>('');
	const [latitude, setLatitude] = useState<string>('');
	const [longitude, setLongitude] = useState<string>('');
	const [address, setAddress] = useState<string>('');
	const [maximumSpaces, setMaximumSpaces] = useState<string>('');
	const [title, setTitle] = useState<string>('');
	const [eventDate, setEventDate] = useState<string>('');
	const [description, setDescription] = useState<string>('');
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

	// Track form states
	const [trackDialogOpen, setTrackDialogOpen] = useState(false);
	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
	const [trackTitle, setTrackTitle] = useState('');
	const [trackStartTime, setTrackStartTime] = useState('');
	const [trackEndTime, setTrackEndTime] = useState('');
	const [trackAbstract, setTrackAbstract] = useState('');
	const [trackLevel, setTrackLevel] = useState('0');
	const [availableSpeakers, setAvailableSpeakers] = useState<SpeakerModel[]>([]);
	const [selectedSpeakers, setSelectedSpeakers] = useState<SpeakerModel[]>([]);
	const [materials, setMaterials] = useState<WorkshopFileModel[]>([]);
	const [photos, setPhotos] = useState<WorkshopFileModel[]>([]);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
	const [materialTitle, setMaterialTitle] = useState('');
	const [materialFile, setMaterialFile] = useState<File | null>(null);
	const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
	const [photoTitle, setPhotoTitle] = useState('');
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [expandedTrackId, setExpandedTrackId] = useState<string | false>(false);
	const [workshopImageFile, setWorkshopImageFile] = useState<File | null>(null);
	const [imageTimestamp, setImageTimestamp] = useState<number>(Date.now());

	useEffect(() => {
		const loadSpeakers = async () => {
			try {
				const response = await fetch(`${API_BASE_URL}/Speaker/Get?onlyActive=true`);
				if (response.ok) {
					const data: SpeakerModel[] = await response.json();
					setAvailableSpeakers(data);
				}
			} catch (error) {
				console.error('Error loading speakers:', error);
			}
		};

		loadSpeakers();
	}, [fetch]);

	useEffect(() => {
		const handleScroll = () => {
			setShowScrollTop(window.scrollY > 300);
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	useEffect(() => {
		const handleScroll = () => {
			setShowScrollTop(window.scrollY > 300);
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	useEffect(() => {
		const loadMaterials = async () => {
			if (!id) return;

			try {
				const response = await fetch(`${API_BASE_URL}/workshopfile/${id}`);
				if (response.ok) {
					const data: WorkshopFileModel[] = await response.json();
					// Filtro per fileType 4 (materials)
					const materialsData = data.filter(file => file.fileType === 4);
					setMaterials(materialsData);
				}
			} catch (error) {
				console.error('Error loading materials:', error);
			}
		};

		const loadPhotos = async () => {
			if (!id) return;

			try {
				const response = await fetch(`${API_BASE_URL}/workshopfile/${id}`);
				if (response.ok) {
					const data: WorkshopFileModel[] = await response.json();
					// Filtro per fileType 2 (photos)
					const photosData = data.filter(file => file.fileType === 2);
					setPhotos(photosData);
				}
			} catch (error) {
				console.error('Error loading photos:', error);
			}
		};

		loadMaterials();
		loadPhotos();
	}, [id, fetch]);

	useEffect(() => {
		const loadWorkshop = async () => {
			if (!id) return;

			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/Workshop/Get/${id}`);
				const data: WorkshopModel = await response.json();
				setWorkshop(data);
				// Populate publication fields
				setPublished(data.published || false);
				setInHomepage((data as WorkshopModel & { in_homepage?: boolean }).in_homepage || false);
				setFeedbackEnabled((data as WorkshopModel & { feedbackEnabled?: boolean }).feedbackEnabled || false);
				// Populate title, eventDate and description fields
				setTitle(data.title || '');
				setEventDate(data.eventDate ? new Date(data.eventDate).toISOString().slice(0, 10) : '');
				setDescription(data.description || '');
				// Populate location fields
				if (data.location) {
					setLocationName(data.location.name || '');
					setAddress(data.location.address || '');
					setMaximumSpaces(data.location.maximumSpaces?.toString() || '');

					// Parse coordinates (format: "latitude,longitude")
					if (data.location.coordinates) {
						const [lat, long] = data.location.coordinates.split(',');
						setLatitude(lat?.trim() || '');
						setLongitude(long?.trim() || '');
					}
				}
			} catch (error) {
				console.error('Error loading workshop:', error);
				setSnackbarMessage('Error loading workshop details');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			} finally {
				setLoading(false);
			}
		};

		loadWorkshop();
	}, [id, fetch]);

	const handleSaveLocation = async () => {
		if (!workshop) return;

		try {
			const coordinates = `${latitude},${longitude}`;
			const updatedWorkshop = {
				...workshop,
				location: {
					name: locationName,
					coordinates: coordinates,
					address: address,
					maximumSpaces: parseInt(maximumSpaces) || 0,
				},
			};

			const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updatedWorkshop),
			});

			if (response.ok) {
				setWorkshop(updatedWorkshop);
				setSnackbarMessage('Location updated successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
			} else {
				throw new Error('Failed to update location');
			}
		} catch (error) {
			console.error('Error updating location:', error);
			setSnackbarMessage('Error updating location');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleSavePublication = async () => {
		if (!workshop) return;

		try {
			const updatedWorkshop = {
				...workshop,
				published: published,
				in_homepage: inHomepage,
				feedbackEnabled: feedbackEnabled,
			};

			const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updatedWorkshop),
			});

			if (response.ok) {
				setWorkshop(updatedWorkshop as WorkshopModel);
				setSnackbarMessage('Publication settings updated successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
			} else {
				throw new Error('Failed to update publication settings');
			}
		} catch (error) {
			console.error('Error updating publication settings:', error);
			setSnackbarMessage('Error updating publication settings');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleSaveDescription = async () => {
		if (!workshop) return;

		try {
			const updatedWorkshop: WorkshopModel = {
				...workshop,
				title: title,
				eventDate: eventDate ? new Date(eventDate) : workshop.eventDate,
				description: description,
			};

			const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updatedWorkshop),
			});

			if (response.ok) {
				setWorkshop(updatedWorkshop);
				setSnackbarMessage('Info updated successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
			} else {
				throw new Error('Failed to update info');
			}
		} catch (error) {
			console.error('Error updating info:', error);
			setSnackbarMessage('Error updating info');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleOpenTrackDialog = () => {
		setEditingTrackId(null);
		setTrackTitle('');
		setTrackStartTime('');
		setTrackEndTime('');
		setTrackAbstract('');
		setTrackLevel('0');
		setSelectedSpeakers([]);
		setTrackDialogOpen(true);
	};

	const handleTrackAccordionChange = (trackId: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
		setExpandedTrackId(isExpanded ? trackId : false);
	};

	const handleEditTrack = (track: TrackModel) => {
		console.log('Editing track:', track.workshopTrackId, track.title);
		setEditingTrackId(track.workshopTrackId);
		setTrackTitle(track.title);
		setTrackStartTime(new Date(track.startTime).toISOString().slice(0, 16));
		setTrackEndTime(new Date(track.endTime).toISOString().slice(0, 16));
		setTrackAbstract(track.abstract || '');
		setTrackLevel(track.level?.toString() || '0');
		// Populate selected speakers from track.speakers (array of IDs)
		const trackSpeakers = availableSpeakers.filter(speaker =>
			track.speakers?.includes(speaker.workshopSpeakerId)
		);
		setSelectedSpeakers(trackSpeakers);
		setTrackDialogOpen(true);
	};

	const handleCloseTrackDialog = () => {
		setTrackDialogOpen(false);
	};

	const handleOpenMaterialDialog = () => {
		setMaterialTitle('');
		setMaterialFile(null);
		setMaterialDialogOpen(true);
	};

	const handleCloseMaterialDialog = () => {
		setMaterialDialogOpen(false);
		setMaterialTitle('');
		setMaterialFile(null);
	};

	const handleOpenPhotoDialog = () => {
		setPhotoTitle('');
		setPhotoFile(null);
		setPhotoDialogOpen(true);
	};

	const handleClosePhotoDialog = () => {
		setPhotoDialogOpen(false);
		setPhotoTitle('');
		setPhotoFile(null);
	};

	const handleWorkshopImageUpload = async (file: File) => {
		if (!workshop || !file) return;

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('workshopId', workshop.workshopId);

			const response = await fetch(`${API_BASE_URL}/workshopfile/uploadworkshopimage`, {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				// Ricarica il workshop per ottenere l'immagine aggiornata
				const workshopResponse = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
				if (workshopResponse.ok) {
					const updatedWorkshop: WorkshopModel = await workshopResponse.json();
					setWorkshop(updatedWorkshop);
					// Aggiorna il timestamp per forzare il reload dell'immagine
					setImageTimestamp(Date.now());
				}

				setSnackbarMessage('Workshop image uploaded successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
				setWorkshopImageFile(file);
			} else {
				throw new Error('Failed to upload workshop image');
			}
		} catch (error) {
			console.error('Error uploading workshop image:', error);
			setSnackbarMessage('Error uploading workshop image');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleDeleteFile = async (workshopFileId: string, fileType: 'material' | 'photo') => {
		if (!window.confirm(`Are you sure you want to delete this ${fileType}?`)) {
			return;
		}

		try {
			const response = await fetch(`${API_BASE_URL}/workshopfile/${workshopFileId}`, {
				method: 'DELETE',
			});

			if (response.ok) {
				setSnackbarMessage(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} deleted successfully`);
				setSnackbarSeverity('success');
				setSnackbarOpen(true);

				// Refresh the list
				if (fileType === 'material') {
					setMaterials(materials.filter(m => m.workshopFileId !== workshopFileId));
				} else {
					setPhotos(photos.filter(p => p.workshopFileId !== workshopFileId));
				}
			} else {
				throw new Error('Failed to delete file');
			}
		} catch (error) {
			console.error(`Error deleting ${fileType}:`, error);
			setSnackbarMessage(`Error deleting ${fileType}`);
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleSaveTrack = async () => {
		if (!workshop || !trackTitle || !trackStartTime || !trackEndTime) {
			setSnackbarMessage('Please fill in all required fields');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
			return;
		}

		try {
			const speakerIds = selectedSpeakers.map(s => s.workshopSpeakerId);
			const speakersNames = selectedSpeakers.map(s => s.name).join(', ');

			// Create Date objects treating the input as UTC to avoid timezone conversion
			// The datetime-local input is in format "YYYY-MM-DDTHH:MM"
			// We append 'Z' to tell the Date constructor to treat it as UTC
			const startTimeDate = new Date(trackStartTime + ':00Z');
			const endTimeDate = new Date(trackEndTime + ':00Z');

			if (editingTrackId) {
				// Update existing track - update the tracks array and save entire workshop
				console.log('startTimeDate:', startTimeDate);
				console.log('startTimeDate ISO:', startTimeDate.toISOString());

				const updatedTracks = (workshop.tracks || []).map(track =>
					track.workshopTrackId === editingTrackId
						? {
							...track,
							title: trackTitle,
							startTime: startTimeDate,
							endTime: endTimeDate,
							abstract: trackAbstract,
							level: parseInt(trackLevel),
							speakers: speakerIds,
							speakersName: speakersNames,
						}
						: track
				);

				const updatedWorkshop = {
					...workshop,
					tracks: updatedTracks,
				};

				console.log('Sending to server:', JSON.stringify(updatedWorkshop, null, 2));

				const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(updatedWorkshop),
				});

				if (!response.ok) {
					throw new Error('Failed to update track');
				}

				// Reload workshop data to get updated tracks
				const workshopResponse = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
				const updatedWorkshopFromServer: WorkshopModel = await workshopResponse.json();
				console.log('Received from server:', updatedWorkshopFromServer.tracks?.map(t => ({
					title: t.title,
					startTime: t.startTime,
					startTimeType: typeof t.startTime
				})));
				setWorkshop(updatedWorkshopFromServer);
				setSnackbarMessage('Track updated successfully');
			} else {
				// Create new track - add to workshop and update entire workshop
				const newTrack: TrackModel = {
					workshopTrackId: '00000000-0000-0000-0000-000000000000',
					title: trackTitle,
					image: '',
					startTime: startTimeDate,
					endTime: endTimeDate,
					abstract: trackAbstract,
					level: parseInt(trackLevel),
					speakers: speakerIds,
					speakersName: speakersNames,
				};

				const updatedWorkshop = {
					...workshop,
					tracks: [...(workshop.tracks || []), newTrack],
				};

				const response = await fetch(`${API_BASE_URL}/Workshop/Update/${workshop.workshopId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(updatedWorkshop),
				});

				if (!response.ok) {
					throw new Error('Failed to create track');
				}

				// Reload workshop data to get updated tracks
				const workshopResponse = await fetch(`${API_BASE_URL}/Workshop/Get/${workshop.workshopId}`);
				const updatedWorkshopFromServer: WorkshopModel = await workshopResponse.json();
				setWorkshop(updatedWorkshopFromServer);
				setSnackbarMessage('Track added successfully');
			}

			setTrackDialogOpen(false);
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
		} catch (error) {
			console.error('Error saving track:', error);
			setSnackbarMessage(editingTrackId ? 'Error updating track' : 'Error adding track');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	if (loading) {
		return (
			<Box sx={{ width: '100%', p: 3, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!workshop) {
		return (
			<Box sx={{ width: '100%', p: 3 }}>
				<Typography variant="h5" color="error">
					Workshop not found
				</Typography>
			</Box>
		);
	}

	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">
					Workshop Edit - {workshop.title}
				</Typography>
				<IconButton onClick={() => navigate('/admin/workshops')} sx={{ color: 'black' }}>
					<ArrowBackIcon />
				</IconButton>
			</Box>

            <Paper elevation={2} sx={{ p: 2, maxWidth: 800, mb: 3, position: 'sticky', top: 10, zIndex: 100, backgroundColor: '#fff' }}>
				<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('publication-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Publication
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('image-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Workshop Image
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('description-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Info
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('location-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Location
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('tracks-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Tracks
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('materials-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Materials
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => document.getElementById('photos-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Photos
					</Button>
				</Box>
			</Paper>

            <Paper id="publication-section" elevation={3} sx={{ p: 3, maxWidth: 800, mb: 3 }}>
				<Grid container spacing={3} sx={{ mb: 2 }}>
					<Grid
                        size={{
                            xs: 12,
                            md: 5
                        }}>
						<Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
							Publication Settings
						</Typography>
					</Grid>
					<Grid
                        size={{
                            xs: 12,
                            md: 7
                        }}>
						<Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, textAlign: 'center' }}>
							Feedback QrCode
						</Typography>
					</Grid>
				</Grid>
				<Grid container spacing={3}>
					<Grid
                        size={{
                            xs: 12,
                            md: 5
                        }}>
						<Box>
							<FormControlLabel
								control={
									<Switch
										checked={published}
										onChange={(e) => setPublished(e.target.checked)}
										color="primary"
									/>
								}
								label="Published"
								sx={{ display: 'block', mb: 2 }}
							/>
							<FormControlLabel
								control={
									<Switch
										checked={inHomepage}
										onChange={(e) => setInHomepage(e.target.checked)}
										color="primary"
									/>
								}
								label="Show in Homepage"
								sx={{ display: 'block', mb: 2 }}
							/>
							<FormControlLabel
								control={
									<Switch
										checked={feedbackEnabled}
										onChange={(e) => setFeedbackEnabled(e.target.checked)}
										color="primary"
									/>
								}
								label="Feedback Enabled"
								sx={{ display: 'block', mb: 3 }}
							/>
							<Button
								variant="contained"
								startIcon={<SaveIcon sx={{ color: '#fff' }} />}
								onClick={handleSavePublication}
								sx={{
									backgroundColor: '#4caf50',
									color: '#fff',
									'&:hover': {
										backgroundColor: '#45a049',
									},
								}}
							>
								Save
							</Button>
						</Box>
					</Grid>
					<Grid
                        size={{
                            xs: 12,
                            md: 7
                        }}>
						<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
							<QRCodeSVG
								value={`${window.location.origin}/feedback/${workshop.workshopId}`}
								size={150}
								level="H"
							/>
							<Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center', wordBreak: 'break-all' }}>
								{`${window.location.origin}/feedback/${workshop.workshopId}`}
							</Typography>
						</Box>
					</Grid>
				</Grid>
			</Paper>

            <Paper id="image-section" elevation={3} sx={{ p: 3, maxWidth: 800, mb: 3 }}>
				<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
					Workshop Image
				</Typography>
				<Grid container spacing={2}>
					{workshop.image && (
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Current Image
							</Typography>
							<Box
								component="img"
								src={`${CONTENT_BASE_URL}${workshop.image.replace(/^\//, '')}?t=${imageTimestamp}`}
								alt={workshop.title}
								sx={{
									width: '100%',
									maxWidth: 400,
									height: 'auto',
									borderRadius: 1,
									border: '1px solid #e0e0e0',
									mb: 2
								}}
								onError={(e) => {
									const target = e.target as HTMLImageElement;
									if (!target.src.includes('placeholder')) {
										target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="16"%3EImage not found%3C/text%3E%3C/svg%3E';
									}
								}}
							/>
						</Grid>
					)}
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Upload workshop cover image
						</Typography>
						<Button
							variant="outlined"
							component="label"
							fullWidth
							sx={{ py: 1.5, justifyContent: 'flex-start' }}
						>
							{workshopImageFile ? workshopImageFile.name : 'Choose image file...'}
							<input
								type="file"
								hidden
								accept="image/*"
								onChange={(e) => {
									if (e.target.files && e.target.files[0]) {
										const file = e.target.files[0];
										handleWorkshopImageUpload(file);
									}
								}}
							/>
						</Button>
					</Grid>
				</Grid>
			</Paper>

            <Paper id="description-section" elevation={3} sx={{ p: 3, maxWidth: 800, mb: 3 }}>
				<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
					Info
				</Typography>
				<Grid container spacing={2}>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Title
						</Typography>
						<TextField
							fullWidth
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Workshop title"
						/>
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
							slotProps={{
                                inputLabel: {
                                    shrink: true,
                                }
                            }}
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Workshop Description
						</Typography>
						<TextField
							fullWidth
							multiline
							rows={6}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Enter workshop description"
						/>
					</Grid>
					<Grid size={12}>
						<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
							<Button
								variant="contained"
								startIcon={<SaveIcon sx={{ color: '#fff' }} />}
								onClick={handleSaveDescription}
								sx={{
									backgroundColor: '#4caf50',
									color: '#fff',
									'&:hover': {
										backgroundColor: '#45a049',
									},
								}}
							>
								Save
							</Button>
						</Box>
					</Grid>
				</Grid>
			</Paper>

            <Paper id="location-section" elevation={3} sx={{ p: 3, maxWidth: 800 }}>
				<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
					Location Information
				</Typography>
				<Grid container spacing={2}>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Name
						</Typography>
						<TextField
							fullWidth
							value={locationName}
							onChange={(e) => setLocationName(e.target.value)}
							placeholder="Location name"
						/>
					</Grid>
					<Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Latitude
						</Typography>
						<TextField
							fullWidth
							value={latitude}
							onChange={(e) => setLatitude(e.target.value)}
							placeholder="Latitude"
						/>
					</Grid>
					<Grid
                        size={{
                            xs: 12,
                            md: 6
                        }}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Longitude
						</Typography>
						<TextField
							fullWidth
							value={longitude}
							onChange={(e) => setLongitude(e.target.value)}
							placeholder="Longitude"
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Address
						</Typography>
						<TextField
							fullWidth
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							placeholder="Address"
						/>
					</Grid>
					<Grid size={12}>
						<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
							Maximum Spaces
						</Typography>
						<TextField
							fullWidth
							type="number"
							value={maximumSpaces}
							onChange={(e) => setMaximumSpaces(e.target.value)}
							placeholder="Maximum Spaces"
						/>
					</Grid>
					<Grid size={12}>
						<Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
							<Button
								variant="contained"
								startIcon={<SaveIcon sx={{ color: '#fff' }} />}
								onClick={handleSaveLocation}
								sx={{
									backgroundColor: '#4caf50',
									color: '#fff',
									'&:hover': {
										backgroundColor: '#45a049',
									},
								}}
							>
								Save
							</Button>
						</Box>
					</Grid>
				</Grid>
			</Paper>

            <Paper id="tracks-section" elevation={3} sx={{ p: 3, maxWidth: 800, mt: 3 }}>
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
					<Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
						Tracks
					</Typography>
					<Button
						variant="contained"
						startIcon={<AddIcon sx={{ color: '#fff' }} />}
						onClick={handleOpenTrackDialog}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Add
					</Button>
				</Box>
				{workshop.tracks && workshop.tracks.length > 0 ? (
					<Box>
						{[...workshop.tracks]
							.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
							.map((track) => (
								<Accordion
									key={track.workshopTrackId}
									expanded={expandedTrackId === track.workshopTrackId}
									onChange={handleTrackAccordionChange(track.workshopTrackId)}
									sx={{
										mb: 1,
										boxShadow: 'none',
										border: '1px solid #e0e0e0',
										'&:before': {
											display: 'none'
										},
										borderLeft: '3px solid #4caf50'
									}}
								>
									<AccordionSummary
										expandIcon={<ExpandMoreIcon />}
										sx={{
											minHeight: '56px',
											'&.Mui-expanded': {
												minHeight: '56px'
											}
										}}
									>
										<Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
											<Typography variant="h6" sx={{ flex: 1 }}>
												{track.title}
											</Typography>
											<IconButton
												color="primary"
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													handleEditTrack(track);
												}}
												sx={{ mr: 1 }}
											>
												<EditIcon />
											</IconButton>
											<IconButton
												color="error"
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													// TODO: Implementare la cancellazione della track
													console.log('Delete track:', track.workshopTrackId);
												}}
												sx={{ mr: 1 }}
											>
												<DeleteIcon />
											</IconButton>
										</Box>
									</AccordionSummary>
									<AccordionDetails sx={{ pt: 2 }}>
										<Grid container spacing={2}>
											<Grid
                                                size={{
                                                    xs: 12,
                                                    md: 6
                                                }}>
												<Typography variant="caption" color="text.secondary">
													Start Time
												</Typography>
												<Typography variant="body2">
													{new Date(track.startTime).toLocaleString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
												</Typography>
											</Grid>
											<Grid
                                                size={{
                                                    xs: 12,
                                                    md: 6
                                                }}>
												<Typography variant="caption" color="text.secondary">
													End Time
												</Typography>
												<Typography variant="body2">
													{new Date(track.endTime).toLocaleString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
												</Typography>
											</Grid>
											<Grid size={12}>
												<Typography variant="caption" color="text.secondary">
													Level
												</Typography>
												<Typography variant="body2">
													{track.level}
												</Typography>
											</Grid>
											{track.speakersName && (
												<Grid size={12}>
													<Typography variant="caption" color="text.secondary">
														Speakers
													</Typography>
													<Typography variant="body2">
														{track.speakersName}
													</Typography>
												</Grid>
											)}
											{track.abstract && (
												<Grid size={12}>
													<Typography variant="caption" color="text.secondary">
														Abstract
													</Typography>
													<Typography variant="body2">
														{track.abstract}
													</Typography>
												</Grid>
											)}
										</Grid>
									</AccordionDetails>
								</Accordion>
							))}
					</Box>
				) : (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography variant="body1" color="text.secondary">
							No tracks available. Click &quot;Add Track&quot; to create one.
						</Typography>
					</Box>
				)}
			</Paper>

            <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mt: 3 }} id="materials-section">
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
					<Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
						Materials
					</Typography>				<Button
						variant="contained"
						startIcon={<AddIcon sx={{ color: '#fff' }} />}
						onClick={handleOpenMaterialDialog}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Add
					</Button>				</Box>
				{materials && materials.length > 0 ? (
					<Box>
						{materials.map((material) => (
							<Card key={material.workshopFileId} sx={{ mb: 2, backgroundColor: '#f8f9fa' }}>
								<CardContent>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
										<DescriptionIcon sx={{ color: 'primary.main', fontSize: 40 }} />
										<Box sx={{ flex: 1 }}>
											<Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
												{material.title}
											</Typography>
											<Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
												{material.fileName}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												File Type: {material.fileType}
											</Typography>
										</Box>
										<IconButton
											onClick={() => handleDeleteFile(material.workshopFileId, 'material')}
											color="error"
											size="small"
										>
											<DeleteIcon />
										</IconButton>
									</Box>
								</CardContent>
							</Card>
						))}
					</Box>
				) : (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography variant="body1" color="text.secondary">
							No materials available.
						</Typography>
					</Box>
				)}
			</Paper>

            <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mt: 3 }} id="photos-section">
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
					<Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
						Photos
					</Typography>
					<Button
						variant="contained"
						startIcon={<AddIcon sx={{ color: '#fff' }} />}
						onClick={handleOpenPhotoDialog}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Add
					</Button>
				</Box>
				{photos && photos.length > 0 ? (
					<Grid container spacing={2}>
						{photos.map((photo) => (
							<Grid
                                key={photo.workshopFileId}
                                size={{
                                    xs: 12,
                                    sm: 6,
                                    md: 4
                                }}>
								<Card sx={{ backgroundColor: '#f8f9fa' }}>
									<Box
										component="img"
										src={photo.fullPath}
										alt={photo.title}
										sx={{
											width: '100%',
											height: 200,
											objectFit: 'cover',
										}}
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											if (!target.src.includes('placeholder')) {
												target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="16"%3EImage not found%3C/text%3E%3C/svg%3E';
											}
										}}
									/>
									<CardContent>
										<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
											<Box sx={{ flex: 1 }}>
												<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
													{photo.title}
												</Typography>
												<Typography variant="caption" color="text.secondary">
													{photo.fileName}
												</Typography>
											</Box>
											<IconButton
												onClick={() => handleDeleteFile(photo.workshopFileId, 'photo')}
												color="error"
												size="small"
											>
												<DeleteIcon />
											</IconButton>
										</Box>
									</CardContent>
								</Card>
							</Grid>
						))}
					</Grid>
				) : (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography variant="body1" color="text.secondary">
							No photos available.
						</Typography>
					</Box>
				)}
			</Paper>

            <Dialog open={trackDialogOpen} onClose={handleCloseTrackDialog} maxWidth="md" fullWidth>
				<DialogTitle>{editingTrackId ? 'Edit Track' : 'Add New Track'}</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ mt: 1 }}>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Title *
							</Typography>
							<TextField
								fullWidth
								value={trackTitle}
								onChange={(e) => setTrackTitle(e.target.value)}
								placeholder="Track title"
							/>
						</Grid>
						<Grid
                            size={{
                                xs: 12,
                                md: 6
                            }}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Start Time *
							</Typography>
							<TextField
								fullWidth
								type="datetime-local"
								value={trackStartTime}
								onChange={(e) => setTrackStartTime(e.target.value)}
								slotProps={{
                                    inputLabel: {
                                        shrink: true,
                                    }
                                }}
							/>
						</Grid>
						<Grid
                            size={{
                                xs: 12,
                                md: 6
                            }}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								End Time *
							</Typography>
							<TextField
								fullWidth
								type="datetime-local"
								value={trackEndTime}
								onChange={(e) => setTrackEndTime(e.target.value)}
								slotProps={{
                                    inputLabel: {
                                        shrink: true,
                                    }
                                }}
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Level
							</Typography>
							<TextField
								fullWidth
								type="number"
								value={trackLevel}
								onChange={(e) => setTrackLevel(e.target.value)}
								placeholder="0"
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Abstract
							</Typography>
							<TextField
								fullWidth
								multiline
								rows={4}
								value={trackAbstract}
								onChange={(e) => setTrackAbstract(e.target.value)}
								placeholder="Track abstract"
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Speakers
							</Typography>
							<Autocomplete
								multiple
								options={availableSpeakers}
								getOptionLabel={(option) => option.name}
								value={selectedSpeakers}
								onChange={(event, newValue) => setSelectedSpeakers(newValue)}
								renderInput={(params) => (
									<TextField
										{...params}
										placeholder="Select speakers"
									/>
								)}
								isOptionEqualToValue={(option, value) => option.workshopSpeakerId === value.workshopSpeakerId}
							/>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseTrackDialog}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={handleSaveTrack}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Save Track
					</Button>
				</DialogActions>
			</Dialog>

            <Dialog open={materialDialogOpen} onClose={handleCloseMaterialDialog} maxWidth="md" fullWidth>
				<DialogTitle>Add Material</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ mt: 1 }}>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Title *
							</Typography>
							<TextField
								fullWidth
								value={materialTitle}
								onChange={(e) => setMaterialTitle(e.target.value)}
								placeholder="Material title"
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								File *
							</Typography>
							<Button
								variant="outlined"
								component="label"
								fullWidth
								sx={{ py: 1.5, justifyContent: 'flex-start' }}
							>
								{materialFile ? materialFile.name : 'Choose file...'}
								<input
									type="file"
									hidden
									onChange={(e) => {
										if (e.target.files && e.target.files[0]) {
											setMaterialFile(e.target.files[0]);
										}
									}}
								/>
							</Button>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseMaterialDialog}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={() => {
							// TODO: Implement material upload
							console.log('Upload material:', materialTitle, materialFile);
							handleCloseMaterialDialog();
						}}
						disabled={!materialTitle || !materialFile}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Upload
					</Button>
				</DialogActions>
			</Dialog>

            <Dialog open={photoDialogOpen} onClose={handleClosePhotoDialog} maxWidth="md" fullWidth>
				<DialogTitle>Add Photo</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ mt: 1 }}>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								Title *
							</Typography>
							<TextField
								fullWidth
								value={photoTitle}
								onChange={(e) => setPhotoTitle(e.target.value)}
								placeholder="Photo title"
							/>
						</Grid>
						<Grid size={12}>
							<Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary' }}>
								File *
							</Typography>
							<Button
								variant="outlined"
								component="label"
								fullWidth
								sx={{ py: 1.5, justifyContent: 'flex-start' }}
							>
								{photoFile ? photoFile.name : 'Choose file...'}
								<input
									type="file"
									hidden
									accept="image/*"
									onChange={(e) => {
										if (e.target.files && e.target.files[0]) {
											setPhotoFile(e.target.files[0]);
										}
									}}
								/>
							</Button>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleClosePhotoDialog}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={() => {
							// TODO: Implement photo upload
							console.log('Upload photo:', photoTitle, photoFile);
							handleClosePhotoDialog();
						}}
						disabled={!photoTitle || !photoFile}
						sx={{
							backgroundColor: '#4caf50',
							color: '#fff',
							'&:hover': {
								backgroundColor: '#45a049',
							},
						}}
					>
						Upload
					</Button>
				</DialogActions>
			</Dialog>

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

            {showScrollTop && (
				<Fab
					color="primary"
					size="medium"
					onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					sx={{
						position: 'fixed',
						bottom: 20,
						right: 20,
						zIndex: 1000,
					}}
				>
					<KeyboardArrowUpIcon />
				</Fab>
			)}
        </Box>
    );
};

export default AdminWorkshopDetail;
