import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton, Paper, Grid, TextField, Switch, FormControlLabel, Snackbar, Alert, Button } from "@mui/material";
import { useParams, useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SpeakerModel from '../../models/SpeakerModel';

const AdminSpeakerDetail: FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const isNewSpeaker = id === 'new';
	const [loading, setLoading] = useState<boolean>(!isNewSpeaker);
	const [speaker, setSpeaker] = useState<SpeakerModel | null>(null);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

	// Form state for new speaker
	const [newSpeakerForm, setNewSpeakerForm] = useState({
		name: '',
		profileImageUrl: '',
		isActive: true,
		description: '',
		email: ''
	});

	// Edit states
	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState('');
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [editedDescription, setEditedDescription] = useState('');
	const [isEditingEmail, setIsEditingEmail] = useState(false);
	const [editedEmail, setEditedEmail] = useState('');

	useEffect(() => {
		if (isNewSpeaker) {
			return; // Skip loading for new speaker
		}

		const loadSpeaker = async () => {
			if (!id) return;

			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/Speaker/Get/${id}`);
				const data = await response.json();
				console.log('Speaker API response:', data);
				setSpeaker(data);
			} catch (error) {
				console.error('Error loading speaker:', error);
				setSnackbarMessage('Error loading speaker details');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			} finally {
				setLoading(false);
			}
		};

		loadSpeaker();
	}, [id, fetch, isNewSpeaker]);

	const handleUpdateField = async (field: string, value: string | boolean | number) => {
		if (!speaker) return;

		try {
			const response = await fetch(`${API_BASE_URL}/Speaker/Update/${speaker.workshopSpeakerId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...speaker, [field]: value })
			});

			if (response.ok) {
				setSpeaker({ ...speaker, [field]: value });
				setSnackbarMessage('Updated successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
			} else {
				throw new Error('Update failed');
			}
		} catch (error) {
			console.error('Error updating speaker:', error);
			setSnackbarMessage('Error updating speaker');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleEditName = () => {
		setEditedName(speaker?.name || '');
		setIsEditingName(true);
	};

	const handleSaveName = () => {
		handleUpdateField('name', editedName);
		setIsEditingName(false);
	};

	const handleCancelEditName = () => {
		setIsEditingName(false);
	};

	const handleEditDescription = () => {
		setEditedDescription(speaker?.description || '');
		setIsEditingDescription(true);
	};

	const handleSaveDescription = () => {
		handleUpdateField('description', editedDescription);
		setIsEditingDescription(false);
	};

	const handleCancelEditDescription = () => {
		setIsEditingDescription(false);
	};

	const handleEditEmail = () => {
		setEditedEmail(speaker?.email || '');
		setIsEditingEmail(true);
	};

	const handleSaveEmail = () => {
		handleUpdateField('email', editedEmail);
		setIsEditingEmail(false);
	};

	const handleCancelEditEmail = () => {
		setIsEditingEmail(false);
	};

	const handleToggleActive = (event: React.ChangeEvent<HTMLInputElement>) => {
		handleUpdateField('isActive', event.target.checked);
	};

	const handleCreateSpeaker = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/Speaker/Post`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					workshopSpeakerId: '00000000-0000-0000-0000-000000000000',
					...newSpeakerForm
				})
			});

			if (response.ok) {
				setSnackbarMessage('Speaker created successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
				setTimeout(() => navigate('/admin/speakers'), 2000);
			} else {
				throw new Error('Creation failed');
			}
		} catch (error) {
			console.error('Error creating speaker:', error);
			setSnackbarMessage('Error creating speaker');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleNewSpeakerChange = (field: string, value: string | boolean | number) => {
		setNewSpeakerForm(prev => ({ ...prev, [field]: value }));
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!isNewSpeaker && !speaker) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography variant="h5">Speaker not found</Typography>
			</Box>
		);
	}

	// Render form for new speaker
	if (isNewSpeaker) {
		return (
            <Box sx={{ width: '100%', p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
					<Typography variant="h4">Create New Speaker</Typography>
					<IconButton onClick={() => navigate('/admin/speakers')} sx={{ color: 'black' }}>
						<ArrowBackIcon />
					</IconButton>
				</Box>
                <Paper elevation={3} sx={{ p: 3 }}>
					<Grid container spacing={3}>
						<Grid size={12}>
							<TextField
								label="Name"
								value={newSpeakerForm.name}
								onChange={(e) => handleNewSpeakerChange('name', e.target.value)}
								fullWidth
								required
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								label="Email"
								type="email"
								value={newSpeakerForm.email}
								onChange={(e) => handleNewSpeakerChange('email', e.target.value)}
								fullWidth
								required
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								label="Profile Image URL"
								value={newSpeakerForm.profileImageUrl}
								onChange={(e) => handleNewSpeakerChange('profileImageUrl', e.target.value)}
								fullWidth
								helperText="Enter the URL or path to the speaker's profile image"
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								label="Description"
								value={newSpeakerForm.description}
								onChange={(e) => handleNewSpeakerChange('description', e.target.value)}
								fullWidth
								multiline
								rows={4}
							/>
						</Grid>
						<Grid size={12}>
							<FormControlLabel
								control={
									<Switch
										checked={newSpeakerForm.isActive}
										onChange={(e) => handleNewSpeakerChange('isActive', e.target.checked)}
										color="primary"
									/>
								}
								label="Active"
							/>
						</Grid>
						<Grid size={12}>
							<Button
								variant="contained"
								onClick={handleCreateSpeaker}
								sx={{
									backgroundColor: '#72C02C',
									color: '#ffffff',
									'&:hover': {
										backgroundColor: '#5da024'
									}
								}}
							>
								Create Speaker
							</Button>
						</Grid>
					</Grid>
				</Paper>

                <Snackbar
					open={snackbarOpen}
					autoHideDuration={6000}
					onClose={() => setSnackbarOpen(false)}
				>
					<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
						{snackbarMessage}
					</Alert>
				</Snackbar>
            </Box>
        );
	}

	// Render edit form for existing speaker
	if (!speaker) {
		return null;
	}

	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">Speaker Detail</Typography>
				<IconButton onClick={() => navigate('/admin/speakers')} sx={{ color: 'black' }}>
					<ArrowBackIcon />
				</IconButton>
			</Box>
            <Paper elevation={3} sx={{ p: 3 }}>
				<Grid container spacing={3}>
					<Grid
                        sx={{ display: 'flex', justifyContent: 'center' }}
                        size={{
                            xs: 12,
                            md: 3
                        }}>
						<img
							src={'profileImageUrl' in speaker ? `/${(speaker as Record<string, unknown>).profileImageUrl}` : (speaker.profileImage ? `/${speaker.profileImage}` : '/speakers/unknown.jpg')}
							alt={speaker.name}
							onError={(e) => {
								const target = e.target as HTMLImageElement;
								console.log('Image error, current src:', target.src);
								if (!target.src.includes('unknown.jpg')) {
									target.src = '/speakers/unknown.jpg';
								}
							}}
							style={{
								width: 205,
								height: 205,
								borderRadius: '8px',
								objectFit: 'cover',
								boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
							}}
						/>
					</Grid>
					<Grid
                        size={{
                            xs: 12,
                            md: 9
                        }}>
						<Paper elevation={1} sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
							<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
								Quick Info
							</Typography>

							{/* Name */}
							<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
								<Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
									{isEditingName ? (
										<>
											<TextField
												value={editedName}
												onChange={(e) => setEditedName(e.target.value)}
												variant="outlined"
												size="small"
												fullWidth
												sx={{
													mr: 1,
													'& .MuiOutlinedInput-root': {
														backgroundColor: '#fff',
														'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
													}
												}}
											/>
											<IconButton onClick={handleSaveName} color="primary" size="small">
												<SaveIcon />
											</IconButton>
											<IconButton onClick={handleCancelEditName} color="error" size="small">
												<CancelIcon />
											</IconButton>
										</>
									) : (
										<>
											<Typography variant="h5" sx={{ flex: 1 }}>{speaker.name}</Typography>
											<IconButton onClick={handleEditName} size="small">
												<EditIcon />
											</IconButton>
										</>
									)}
								</Box>
							</Box>

							<Grid container spacing={2}>
								{/* IsActive */}
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 4
                                    }}>
									<FormControlLabel
										control={
											<Switch
												checked={speaker.isActive}
												onChange={handleToggleActive}
												color="primary"
											/>
										}
										label="Active"
									/>
								</Grid>

								{/* Email */}
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 6
                                    }}>
									<Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Email</Typography>
									{isEditingEmail ? (
										<Box sx={{ display: 'flex', alignItems: 'center' }}>
											<TextField
												value={editedEmail}
												onChange={(e) => setEditedEmail(e.target.value)}
												variant="outlined"
												size="small"
												fullWidth
												sx={{
													mr: 0.5,
													'& .MuiOutlinedInput-root': {
														backgroundColor: '#fff',
														'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
													}
												}}
											/>
											<IconButton onClick={handleSaveEmail} color="primary" size="small">
												<SaveIcon fontSize="small" />
											</IconButton>
											<IconButton onClick={handleCancelEditEmail} color="error" size="small">
												<CancelIcon fontSize="small" />
											</IconButton>
										</Box>
									) : (
										<Box sx={{ display: 'flex', alignItems: 'center' }}>
											<Typography variant="body2" sx={{ flex: 1 }}>
												{speaker.email || 'N/A'}
											</Typography>
											<IconButton onClick={handleEditEmail} size="small">
												<EditIcon fontSize="small" />
											</IconButton>
										</Box>
									)}
								</Grid>

								{/* Description */}
								<Grid size={12}>
									<Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>Description</Typography>
									{isEditingDescription ? (
										<Box sx={{ display: 'flex', alignItems: 'center' }}>
											<TextField
												value={editedDescription}
												onChange={(e) => setEditedDescription(e.target.value)}
												variant="outlined"
												size="small"
												fullWidth
												multiline
												rows={3}
												sx={{
													mr: 0.5,
													'& .MuiOutlinedInput-root': {
														backgroundColor: '#fff',
														'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
													}
												}}
											/>
											<Box>
												<IconButton onClick={handleSaveDescription} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditDescription} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										</Box>
									) : (
										<Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
											<Typography variant="body2" sx={{ flex: 1 }}>
												{speaker.description || 'N/A'}
											</Typography>
											<IconButton onClick={handleEditDescription} size="small">
												<EditIcon fontSize="small" />
											</IconButton>
										</Box>
									)}
								</Grid>
							</Grid>
						</Paper>
					</Grid>
				</Grid>
			</Paper>

            <Snackbar
				open={snackbarOpen}
				autoHideDuration={6000}
				onClose={() => setSnackbarOpen(false)}
			>
				<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
					{snackbarMessage}
				</Alert>
			</Snackbar>
        </Box>
    );
};

export default AdminSpeakerDetail;
