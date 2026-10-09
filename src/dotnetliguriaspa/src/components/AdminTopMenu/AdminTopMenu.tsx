import React, { FC, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/apiConfig';
import { useOidcFetch } from "@axa-fr/react-oidc";
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import TopMenuElementModel from '../../models/TopMenuElementModel';
import { Box, Button, IconButton, TextField, Typography } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';

interface AdminTopMenuProps { pageName?: string }

const AdminTopMenu: FC<AdminTopMenuProps> = () => {
	const { fetch } = useOidcFetch();
	const navigate = useNavigate();
	const [dataRows, setDataRows] = useState<TopMenuElementModel[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [searchText, setSearchText] = useState<string>('');

	const handleViewDetails = (topMenuElementId: string) => {
		navigate(`/admin/topmenu/${topMenuElementId}`);
	};

	const handleAddTopMenu = () => {
		navigate('/admin/topmenu/new');
	};

	const columns: GridColDef[] = [
		{ field: 'order', headerName: 'Order', width: 80 },
		{ field: 'name', headerName: 'Name', width: 250, flex: 1 },
		{ field: 'url', headerName: 'URL', width: 300, flex: 1 },
		{
			field: 'isActive',
			headerName: 'Active',
			width: 100,
			renderCell: (params) => (
				<Box
					sx={{
						width: 16,
						height: 16,
						borderRadius: '50%',
						backgroundColor: params.row.isActive ? '#4caf50' : '#f44336',
					}}
				/>
			),
		},
		{
			field: 'actions',
			headerName: 'Actions',
			width: 100,
			sortable: false,
			renderCell: (params) => (
				<IconButton
					color="primary"
					onClick={() => handleViewDetails(params.row.topMenuElementId)}
				>
					<EditIcon />
				</IconButton>
			),
		},
	];

	useEffect(() => {
		const loadTopMenuElements = async () => {
			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/TopMenu`);
				const data = await response.json();
				setDataRows(data);
			} catch (error) {
				console.error('Error loading top menu elements:', error);
			} finally {
				setLoading(false);
			}
		}
		loadTopMenuElements();
	}, [fetch]);

	const filteredRows = dataRows.filter(element =>
		element.name.toLowerCase().includes(searchText.toLowerCase())
	);

	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">
					Top Menu
				</Typography>
				<Button
					variant="contained"
					startIcon={<AddIcon sx={{ color: '#ffffff' }} />}
					onClick={handleAddTopMenu}
					sx={{
						backgroundColor: '#72C02C',
						color: '#ffffff',
						'&:hover': {
							backgroundColor: '#5da024'
						}
					}}
				>
					Add
				</Button>
			</Box>
            <Box sx={{ mb: 2 }}>
				<TextField
					fullWidth
					variant="outlined"
					placeholder="Search by name..."
					value={searchText}
					onChange={(e) => setSearchText(e.target.value)}
					slotProps={{
                        input: {
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                        }
                    }}
				/>
			</Box>
            <Box sx={{ height: 600, width: '100%' }}>
				<DataGrid
					getRowId={(row) => row.topMenuElementId}
					rows={filteredRows}
					columns={columns}
					loading={loading}
					initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
					pageSizeOptions={[5, 10, 25]}
					disableRowSelectionOnClick
				/>
			</Box>
        </Box>
    );
};

export default AdminTopMenu;
