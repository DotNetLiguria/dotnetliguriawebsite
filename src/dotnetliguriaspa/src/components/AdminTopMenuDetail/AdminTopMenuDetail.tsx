import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, IconButton, Paper, Grid, TextField, Switch, FormControlLabel, Snackbar, Alert, Button } from "@mui/material";
import { useParams, useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import TopMenuElementModel from '../../models/TopMenuElementModel';

const AdminTopMenuDetail: FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const isNewElement = id === 'new';
	const [loading, setLoading] = useState<boolean>(!isNewElement);
	const [element, setElement] = useState<TopMenuElementModel | null>(null);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

	// Form state for new element
	const [newElementForm, setNewElementForm] = useState({
		name: '',
		url: '',
		order: 0,
		isActive: true
	});

	// Edit states
	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState('');
	const [isEditingUrl, setIsEditingUrl] = useState(false);
	const [editedUrl, setEditedUrl] = useState('');
	const [isEditingOrder, setIsEditingOrder] = useState(false);
	const [editedOrder, setEditedOrder] = useState(0);

	useEffect(() => {
		if (isNewElement) {
			return;
		}

		const loadElement = async () => {
			if (!id) return;

			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/TopMenu/${id}`);
				const data = await response.json();
				setElement(data);
			} catch (error) {
				console.error('Error loading top menu element:', error);
				setSnackbarMessage('Error loading element details');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			} finally {
				setLoading(false);
			}
		};

		loadElement();
	}, [id, fetch, isNewElement]);

	const handleUpdateField = async (field: string, value: string | boolean | number) => {
		if (!element) return;

		try {
			const response = await fetch(`${API_BASE_URL}/TopMenu/${element.topMenuElementId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...element, [field]: value })
			});

			if (response.ok) {
				setElement({ ...element, [field]: value });
				setSnackbarMessage('Updated successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
			} else {
				throw new Error('Update failed');
			}
		} catch (error) {
			console.error('Error updating element:', error);
			setSnackbarMessage('Error updating element');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleEditName = () => {
		setEditedName(element?.name || '');
		setIsEditingName(true);
	};

	const handleSaveName = () => {
		handleUpdateField('name', editedName);
		setIsEditingName(false);
	};

	const handleCancelEditName = () => {
		setIsEditingName(false);
	};

	const handleEditUrl = () => {
		setEditedUrl(element?.url || '');
		setIsEditingUrl(true);
	};

	const handleSaveUrl = () => {
		handleUpdateField('url', editedUrl);
		setIsEditingUrl(false);
	};

	const handleCancelEditUrl = () => {
		setIsEditingUrl(false);
	};

	const handleEditOrder = () => {
		setEditedOrder(element?.order || 0);
		setIsEditingOrder(true);
	};

	const handleSaveOrder = () => {
		handleUpdateField('order', editedOrder);
		setIsEditingOrder(false);
	};

	const handleCancelEditOrder = () => {
		setIsEditingOrder(false);
	};

	const handleToggleActive = (event: React.ChangeEvent<HTMLInputElement>) => {
		handleUpdateField('isActive', event.target.checked);
	};

	const handleCreateElement = async () => {
		try {
			const response = await fetch(`${API_BASE_URL}/TopMenu`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topMenuElementId: '00000000-0000-0000-0000-000000000000',
					...newElementForm
				})
			});

			if (response.ok) {
				setSnackbarMessage('Top menu element created successfully');
				setSnackbarSeverity('success');
				setSnackbarOpen(true);
				setTimeout(() => navigate('/admin/topmenu'), 2000);
			} else {
				throw new Error('Creation failed');
			}
		} catch (error) {
			console.error('Error creating element:', error);
			setSnackbarMessage('Error creating element');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		}
	};

	const handleNewElementChange = (field: string, value: string | boolean | number) => {
		setNewElementForm(prev => ({ ...prev, [field]: value }));
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!isNewElement && !element) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography variant="h5">Element not found</Typography>
			</Box>
		);
	}

	// Render form for new element
	if (isNewElement) {
		return (
            <Box sx={{ width: '100%', p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
					<Typography variant="h4">Create New Top Menu Element</Typography>
					<IconButton onClick={() => navigate('/admin/topmenu')} sx={{ color: 'black' }}>
						<ArrowBackIcon />
					</IconButton>
				</Box>
                <Paper elevation={3} sx={{ p: 3 }}>
					<Grid container spacing={3}>
						<Grid size={12}>
							<TextField
								label="Name"
								value={newElementForm.name}
								onChange={(e) => handleNewElementChange('name', e.target.value)}
								fullWidth
								required
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								label="URL"
								value={newElementForm.url}
								onChange={(e) => handleNewElementChange('url', e.target.value)}
								fullWidth
								required
								placeholder="e.g., /#evidence or /workshops"
							/>
						</Grid>
						<Grid size={12}>
							<TextField
								label="Order"
								type="number"
								value={newElementForm.order}
								onChange={(e) => handleNewElementChange('order', parseInt(e.target.value) || 0)}
								fullWidth
								required
							/>
						</Grid>
						<Grid size={12}>
							<FormControlLabel
								control={
									<Switch
										checked={newElementForm.isActive}
										onChange={(e) => handleNewElementChange('isActive', e.target.checked)}
									/>
								}
								label="Active"
							/>
						</Grid>
						<Grid size={12}>
							<Button
								variant="contained"
								onClick={handleCreateElement}
								sx={{
									backgroundColor: '#72C02C',
									color: '#ffffff',
									'&:hover': {
										backgroundColor: '#5da024'
									}
								}}
							>
								Create Element
							</Button>
						</Grid>
					</Grid>
				</Paper>
                <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
					<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
						{snackbarMessage}
					</Alert>
				</Snackbar>
            </Box>
        );
	}

	// Render details for existing element
	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">Top Menu Element Details</Typography>
				<IconButton onClick={() => navigate('/admin/topmenu')} sx={{ color: 'black' }}>
					<ArrowBackIcon />
				</IconButton>
			</Box>

            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
				<Grid container spacing={3}>
					<Grid size={12}>
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<Typography variant="h6">Name</Typography>
							{!isEditingName && (
								<IconButton onClick={handleEditName} sx={{ color: 'black' }}>
									<EditIcon />
								</IconButton>
							)}
						</Box>
						{isEditingName ? (
							<Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
								<TextField
									fullWidth
									value={editedName}
									onChange={(e) => setEditedName(e.target.value)}
								/>
								<IconButton onClick={handleSaveName} sx={{ color: '#72C02C' }}>
									<SaveIcon />
								</IconButton>
								<IconButton onClick={handleCancelEditName} sx={{ color: '#f44336' }}>
									<CancelIcon />
								</IconButton>
							</Box>
						) : (
							<Typography variant="body1">{element?.name}</Typography>
						)}
					</Grid>

					<Grid size={12}>
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<Typography variant="h6">URL</Typography>
							{!isEditingUrl && (
								<IconButton onClick={handleEditUrl} sx={{ color: 'black' }}>
									<EditIcon />
								</IconButton>
							)}
						</Box>
						{isEditingUrl ? (
							<Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
								<TextField
									fullWidth
									value={editedUrl}
									onChange={(e) => setEditedUrl(e.target.value)}
								/>
								<IconButton onClick={handleSaveUrl} sx={{ color: '#72C02C' }}>
									<SaveIcon />
								</IconButton>
								<IconButton onClick={handleCancelEditUrl} sx={{ color: '#f44336' }}>
									<CancelIcon />
								</IconButton>
							</Box>
						) : (
							<Typography variant="body1">{element?.url}</Typography>
						)}
					</Grid>

					<Grid size={12}>
						<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<Typography variant="h6">Order</Typography>
							{!isEditingOrder && (
								<IconButton onClick={handleEditOrder} sx={{ color: 'black' }}>
									<EditIcon />
								</IconButton>
							)}
						</Box>
						{isEditingOrder ? (
							<Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
								<TextField
									fullWidth
									type="number"
									value={editedOrder}
									onChange={(e) => setEditedOrder(parseInt(e.target.value) || 0)}
								/>
								<IconButton onClick={handleSaveOrder} sx={{ color: '#72C02C' }}>
									<SaveIcon />
								</IconButton>
								<IconButton onClick={handleCancelEditOrder} sx={{ color: '#f44336' }}>
									<CancelIcon />
								</IconButton>
							</Box>
						) : (
							<Typography variant="body1">{element?.order}</Typography>
						)}
					</Grid>

					<Grid size={12}>
						<FormControlLabel
							control={
								<Switch
									checked={element?.isActive || false}
									onChange={handleToggleActive}
								/>
							}
							label="Active"
						/>
					</Grid>
				</Grid>
			</Paper>

            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
				<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
					{snackbarMessage}
				</Alert>
			</Snackbar>
        </Box>
    );
};

export default AdminTopMenuDetail;
