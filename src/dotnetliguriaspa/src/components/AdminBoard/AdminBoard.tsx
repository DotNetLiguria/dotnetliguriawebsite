import React, { FC, useEffect, useState } from 'react';
import { useOidcFetch } from "@axa-fr/react-oidc";
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { BoardProfileModel } from '../../models/BoadProfileModel';
import { Box, IconButton, Typography } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/apiConfig';

interface AdminBoardProps {
	pageName?: string;
}

const AdminBoard: FC<AdminBoardProps> = () => {
	const { fetch } = useOidcFetch();
	const navigate = useNavigate();
	const [dataRows, setDataRows] = useState<BoardProfileModel[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	const handleViewDetails = (memberId: string) => {
		navigate(`/admin/board/${memberId}`);
	};

	const columns: GridColDef[] = [
		{ field: 'name', headerName: 'Name', width: 250, flex: 1 },
		{ field: 'order', headerName: 'Order', width: 100 },
		{ field: 'description', headerName: 'Description', width: 300, flex: 1 },
		{ field: 'email', headerName: 'Email', width: 300, flex: 1 },
		{
			field: 'isActive',
			headerName: 'Visibile',
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
					onClick={() => handleViewDetails(params.row.id)}
				>
					<EditIcon />
				</IconButton>
			),
		},
	];

	useEffect(() => {
		const loadBoardMembers = async () => {
			setLoading(true);
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Get`);
				const data = await response.json();
				// Ensure each row has a unique id
				const dataWithIds = data.map((item: BoardProfileModel, index: number) => ({
					...item,
					id: item.boardId || item.id || item.email || `board-member-${index}`
				}));
				setDataRows(dataWithIds);
			} catch (error) {
				console.error('Error loading board members:', error);
			} finally {
				setLoading(false);
			}
		}
		loadBoardMembers();
	}, [fetch]);

	return (
		<Box sx={{ width: '100%', p: 3 }}>
			<Typography variant="h4" sx={{ mb: 3 }}>
				Board
			</Typography>
			<Box sx={{ height: 600, width: '100%' }}>
				<DataGrid
					getRowId={(row) => row.id}
					rows={dataRows}
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

export default AdminBoard;
