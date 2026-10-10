import React, { FC, useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Snackbar, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useOidcFetch } from '@axa-fr/react-oidc';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { API_BASE_URL } from '../../config/apiConfig';
import { VenueModel } from '../../models/VenueModel';

type VenueForm = Omit<VenueModel, 'venueId'>;

const emptyVenueForm: VenueForm = {
	name: '',
	coordinates: '',
	address: '',
	googleMapsUrl: '',
	maximumSpaces: 0,
};

const AdminVenues: FC = () => {
	const { fetch } = useOidcFetch();
	const [venues, setVenues] = useState<VenueModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [formOpen, setFormOpen] = useState(false);
	const [editingVenue, setEditingVenue] = useState<VenueModel | null>(null);
	const [form, setForm] = useState<VenueForm>(emptyVenueForm);
	const [pendingDelete, setPendingDelete] = useState<VenueModel | null>(null);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
	const [snackbarOpen, setSnackbarOpen] = useState(false);

	const showMessage = useCallback((message: string, severity: 'success' | 'error') => {
		setSnackbarMessage(message);
		setSnackbarSeverity(severity);
		setSnackbarOpen(true);
	}, []);

	useEffect(() => {
		const loadVenues = async () => {
			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/Venue`);
				if (!response.ok) {
					throw new Error(`Failed to load venues (HTTP ${response.status})`);
				}
				const data: VenueModel[] = await response.json();
				setVenues(data);
			} catch (error) {
				console.error('Error loading venues:', error);
				showMessage(error instanceof Error ? error.message : 'Error loading venues', 'error');
			} finally {
				setLoading(false);
			}
		};

		void loadVenues();
	}, [fetch, showMessage]);

	const openCreateForm = () => {
		setEditingVenue(null);
		setForm({ ...emptyVenueForm });
		setFormOpen(true);
	};

	const openEditForm = (venue: VenueModel) => {
		setEditingVenue(venue);
		setForm({
			name: venue.name,
			coordinates: venue.coordinates ?? '',
			address: venue.address ?? '',
			googleMapsUrl: venue.googleMapsUrl ?? '',
			maximumSpaces: venue.maximumSpaces,
		});
		setFormOpen(true);
	};

	const handleSave = async () => {
		if (!form.name.trim() || !form.address?.trim()) {
			showMessage('Venue name and address are required', 'error');
			return;
		}

		const isEditing = editingVenue !== null;
		const url = isEditing ? `${API_BASE_URL}/Venue/${editingVenue.venueId}` : `${API_BASE_URL}/Venue`;
		try {
			const response = await fetch(url, {
				method: isEditing ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...form, name: form.name.trim(), address: form.address.trim() }),
			});
			if (!response.ok) {
				const responseText = await response.text();
				throw new Error(responseText || `Failed to save venue (HTTP ${response.status})`);
			}

			if (isEditing) {
				setVenues((current) => current.map((venue) => venue.venueId === editingVenue.venueId ? { ...editingVenue, ...form } : venue));
			} else {
				const createdVenue: VenueModel = await response.json();
				setVenues((current) => [...current, createdVenue].sort((left, right) => left.name.localeCompare(right.name)));
			}
			setFormOpen(false);
			showMessage(isEditing ? 'Venue updated successfully' : 'Venue created successfully', 'success');
		} catch (error) {
			console.error('Error saving venue:', error);
			showMessage(error instanceof Error ? error.message : 'Error saving venue', 'error');
		}
	};

	const handleDelete = async () => {
		if (!pendingDelete) {
			return;
		}

		try {
			const response = await fetch(`${API_BASE_URL}/Venue/${pendingDelete.venueId}`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error(`Failed to delete venue (HTTP ${response.status})`);
			}
			setVenues((current) => current.filter((venue) => venue.venueId !== pendingDelete.venueId));
			showMessage('Venue deleted successfully', 'success');
		} catch (error) {
			console.error('Error deleting venue:', error);
			showMessage(error instanceof Error ? error.message : 'Error deleting venue', 'error');
		} finally {
			setPendingDelete(null);
		}
	};

	const columns: GridColDef<VenueModel>[] = [
		{ field: 'name', headerName: 'Name', minWidth: 180, flex: 1 },
		{ field: 'address', headerName: 'Address', minWidth: 220, flex: 1 },
		{ field: 'googleMapsUrl', headerName: 'Google Maps', minWidth: 200, flex: 1 },
		{
			field: 'actions',
			headerName: 'Actions',
			width: 110,
			sortable: false,
			renderCell: (params) => (
				<>
					<IconButton aria-label={`Edit ${params.row.name}`} onClick={() => openEditForm(params.row)}>
						<EditIcon />
					</IconButton>
					<IconButton aria-label={`Delete ${params.row.name}`} onClick={() => setPendingDelete(params.row)}>
						<DeleteIcon />
					</IconButton>
				</>
			),
		},
	];

	return (
		<Box sx={{ width: '100%', p: 3 }}>
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">Venues / Sale eventi</Typography>
				<Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm}>Add venue</Button>
			</Box>
			<Box sx={{ height: 600, width: '100%' }}>
				<DataGrid
					getRowId={(venue) => venue.venueId}
					rows={venues}
					columns={columns}
					loading={loading}
					initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
					pageSizeOptions={[5, 10, 25]}
					disableRowSelectionOnClick
				/>
			</Box>

			<Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
				<DialogTitle>{editingVenue ? 'Edit venue' : 'Add venue'}</DialogTitle>
				<DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
					<TextField label="Name" placeholder="Venue name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
					<TextField label="Address" placeholder="Venue address" value={form.address ?? ''} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required />
					<TextField label="Coordinates" placeholder="Latitude, longitude" value={form.coordinates ?? ''} onChange={(event) => setForm((current) => ({ ...current, coordinates: event.target.value }))} />
					<TextField label="Google Maps URL" type="url" placeholder="https://maps.google.com/..." value={form.googleMapsUrl ?? ''} onChange={(event) => setForm((current) => ({ ...current, googleMapsUrl: event.target.value }))} />
					<TextField label="Maximum spaces" type="number" value={form.maximumSpaces} onChange={(event) => setForm((current) => ({ ...current, maximumSpaces: Number(event.target.value) || 0 }))} />
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setFormOpen(false)}>Cancel</Button>
					<Button onClick={() => void handleSave()} variant="contained">{editingVenue ? 'Save' : 'Create'}</Button>
				</DialogActions>
			</Dialog>

			<Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
				<DialogTitle>Delete venue?</DialogTitle>
				<DialogContent>
					<Typography>Delete {pendingDelete?.name}? Existing workshops keep their saved location details.</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setPendingDelete(null)}>Cancel</Button>
					<Button onClick={() => void handleDelete()} color="error" variant="contained">Delete</Button>
				</DialogActions>
			</Dialog>

			<Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
				<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>{snackbarMessage}</Alert>
			</Snackbar>
		</Box>
	);
};

export default AdminVenues;
