import React, { FC, useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Snackbar, Alert, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';

const AdminWorkshopCreate: FC = () => {
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [eventDate, setEventDate] = useState('');
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		if (!title || !description || !eventDate) {
			setSnackbarMessage('Please fill in all fields');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
			return;
		}

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
				}),
			});

			if (response.ok) {
				setSnackbarMessage('Workshop created successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
				setTimeout(() => {
					navigate('/admin/workshops');
				}, 1500);
			} else {
				throw new Error('Failed to create workshop');
			}
		} catch (error) {
			console.error('Error creating workshop:', error);
			setSnackbarMessage('Error creating workshop');
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
