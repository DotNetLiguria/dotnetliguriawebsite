import React, { FC, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/apiConfig';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { WorkshopModel } from '../../models/WorkshopModel';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, IconButton, Typography, Button, TextField } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';

interface AdminWorkshopsProps { pageName?: string }

const AdminWorkshops: FC<AdminWorkshopsProps> = () => {

    const { fetch } = useOidcFetch();
    const navigate = useNavigate();
    const [dataRows, setDataRows] = useState<WorkshopModel[]>([]);
    const [searchText, setSearchText] = useState<string>('');

    const handleViewDetails = (workshopId: string) => {
        navigate(`/admin/workshop/${workshopId}`);
    };

    const columns: GridColDef[] = [
        { field: 'title', headerName: 'Title', width: 350, resizable: true, flex: 1 },
        {
            field: 'eventDate',
            headerName: 'Event Date',
            width: 200,
            resizable: true,
            valueFormatter: (value: string | null) => {
                if (value) {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                }
                return '';
            }
        },
        {
            field: 'published',
            headerName: 'Published',
            width: 130,
            resizable: true,
            renderCell: (params) => (
                <Box
                    sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: params.value ? '#4caf50' : '#f44336',
                    }}
                />
            )
        },
        {
            field: 'in_homepage',
            headerName: 'In Homepage',
            width: 130,
            resizable: true,
            renderCell: (params) => (
                <Box
                    sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: params.value ? '#4caf50' : '#f44336',
                    }}
                />
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 100,
            sortable: false,
            renderCell: (params) => (
                <IconButton
                    color="primary"
                    onClick={() => handleViewDetails(params.row.workshopId)}
                >
                    <EditIcon />
                </IconButton>
            ),
        },
    ];

    useEffect(() => {
        const loadWorkshops = async () => {
            await fetch(`${API_BASE_URL}/Workshop/Get?onlyPublished=false`)
                .then(response => response.json())
                .then(data => {
                    setDataRows(data);
                }).catch(error => console.error('Error:', error));
        }
        loadWorkshops().catch(console.error);
    }, []);

    const filteredRows = dataRows.filter(workshop =>
        workshop.title.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ width: '80%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    Workshops
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon sx={{ color: '#fff' }} />}
                    onClick={() => navigate('/admin/workshop/create')}
                    sx={{
                        backgroundColor: '#4caf50',
                        color: '#fff',
                        '&:hover': {
                            backgroundColor: '#45a049'
                        }
                    }}
                >
                    Create
                </Button>
            </Box>
            <Box sx={{ mb: 2, width: '80%' }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Cerca per titolo workshop..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                        }
                    }}
                />
            </Box>
            <Box sx={{ height: 365, width: '100%' }}>
                <DataGrid
                    style={{ height: 365, width: "80%" }}
                    getRowId={(data) => data.workshopId}
                    rows={filteredRows}
                    columns={columns}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                        pagination: {
                            paginationModel: { page: 0, pageSize: 5 }
                        },
                    }}
                />
            </Box>
        </Box>
    );
};

export default AdminWorkshops;

