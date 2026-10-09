import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, CircularProgress, TextField, IconButton, Snackbar, Alert, Switch, FormControlLabel } from "@mui/material";
import { useParams, useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../../config/apiConfig';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import TwitterIcon from '@mui/icons-material/Twitter';
import FacebookIcon from '@mui/icons-material/Facebook';
import ArticleIcon from '@mui/icons-material/Article';
import InstagramIcon from '@mui/icons-material/Instagram';
import './AdminBoardDetail.css';

interface BoardMemberDetail {
	boardId: string;
	name: string;
	order: number;
	description: string;
	profileBio: string | null;
	role: string | null;
	profileImageUrl: string;
	profileImage: string | null;
	blogHtml: string | null;
	userName: string | null;
	email: string | null;
	lInkedinUrl: string | null;
	twitterUrl: string | null;
	gitHubUrl: string | null;
	faceboookUrl: string | null;
	instagramUrl: string | null;
	shortBio: string;
	fullBio: string;
	isActive: boolean;
}

interface AdminBoardDetailProps {
	pageName?: string;
}

const AdminBoardDetail: FC<AdminBoardDetailProps> = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { fetch } = useOidcFetch();
	const [boardMember, setBoardMember] = useState<BoardMemberDetail | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [isEditingName, setIsEditingName] = useState<boolean>(false);
	const [editedName, setEditedName] = useState<string>('');
	const [isEditingOrder, setIsEditingOrder] = useState<boolean>(false);
	const [editedOrder, setEditedOrder] = useState<number>(0);
	const [isEditingDescription, setIsEditingDescription] = useState<boolean>(false);
	const [editedDescription, setEditedDescription] = useState<string>('');
	const [isEditingEmail, setIsEditingEmail] = useState<boolean>(false);
	const [editedEmail, setEditedEmail] = useState<string>('');
	const [isEditingShortBio, setIsEditingShortBio] = useState<boolean>(false);
	const [editedShortBio, setEditedShortBio] = useState<string>('');
	const [isEditingFullBio, setIsEditingFullBio] = useState<boolean>(false);
	const [editedFullBio, setEditedFullBio] = useState<string>('');
	const [isEditingBlogHtml, setIsEditingBlogHtml] = useState<boolean>(false);
	const [editedBlogHtml, setEditedBlogHtml] = useState<string>('');
	const [isEditingLinkedIn, setIsEditingLinkedIn] = useState<boolean>(false);
	const [editedLinkedIn, setEditedLinkedIn] = useState<string>('');
	const [isEditingGitHub, setIsEditingGitHub] = useState<boolean>(false);
	const [editedGitHub, setEditedGitHub] = useState<string>('');
	const [isEditingTwitter, setIsEditingTwitter] = useState<boolean>(false);
	const [editedTwitter, setEditedTwitter] = useState<string>('');
	const [isEditingFacebook, setIsEditingFacebook] = useState<boolean>(false);
	const [editedFacebook, setEditedFacebook] = useState<string>('');
	const [isEditingInstagram, setIsEditingInstagram] = useState<boolean>(false);
	const [editedInstagram, setEditedInstagram] = useState<string>('');
	const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
	const [snackbarMessage, setSnackbarMessage] = useState<string>('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

	useEffect(() => {
		const loadBoardMember = async () => {
			try {
				setLoading(true);
				const response = await fetch(`${API_BASE_URL}/Board/Get/${id}`);
				const data = await response.json();
				setBoardMember(data);
				setEditedName(data.name);
				setEditedOrder(data.order || 0);
				setEditedDescription(data.description);
				setEditedEmail(data.email || '');
				setEditedShortBio(data.shortBio || '');
				setEditedFullBio(data.fullBio || '');
				setEditedBlogHtml(data.blogHtml || '');
				setEditedLinkedIn(data.lInkedinUrl || '');
				setEditedGitHub(data.gitHubUrl || '');
				setEditedTwitter(data.twitterUrl || '');
				setEditedFacebook(data.faceboookUrl || '');
				setEditedInstagram(data.instagramUrl || '');
			} catch (error) {
				console.error('Error loading board member:', error);
			} finally {
				setLoading(false);
			}
		};

		if (id) {
			loadBoardMember();
		}
	}, [id, fetch]);

	const handleEditName = () => {
		setIsEditingName(true);
	};

	const handleSaveName = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, name: editedName })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, name: editedName });
					setSnackbarMessage('Name updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update name');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating name');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingName(false);
	};

	const handleCancelEdit = () => {
		setEditedName(boardMember?.name || '');
		setIsEditingName(false);
	};

	const handleEditOrder = () => {
		setIsEditingOrder(true);
	};

	const handleSaveOrder = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, order: editedOrder })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, order: editedOrder });
					setSnackbarMessage('Order updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update order');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating order');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingOrder(false);
	};

	const handleCancelEditOrder = () => {
		setEditedOrder(boardMember?.order || 0);
		setIsEditingOrder(false);
	};

	const handleEditDescription = () => {
		setIsEditingDescription(true);
	};

	const handleSaveDescription = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, description: editedDescription })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, description: editedDescription });
					setSnackbarMessage('Description updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update description');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating description');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingDescription(false);
	};

	const handleCancelEditDescription = () => {
		setEditedDescription(boardMember?.description || '');
		setIsEditingDescription(false);
	};

	const handleEditEmail = () => {
		setIsEditingEmail(true);
	};

	const handleSaveEmail = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, email: editedEmail })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, email: editedEmail });
					setSnackbarMessage('Email updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update email');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating email');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingEmail(false);
	};

	const handleCancelEditEmail = () => {
		setEditedEmail(boardMember?.email || '');
		setIsEditingEmail(false);
	};

	const handleEditShortBio = () => {
		setIsEditingShortBio(true);
	};

	const handleSaveShortBio = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, shortBio: editedShortBio })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, shortBio: editedShortBio });
					setSnackbarMessage('Short bio updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update short bio');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating short bio');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingShortBio(false);
	};

	const handleCancelEditShortBio = () => {
		setEditedShortBio(boardMember?.shortBio || '');
		setIsEditingShortBio(false);
	};

	const handleEditFullBio = () => {
		setIsEditingFullBio(true);
	};

	const handleSaveFullBio = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, fullBio: editedFullBio })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, fullBio: editedFullBio });
					setSnackbarMessage('Full bio updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update full bio');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating full bio');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingFullBio(false);
	};

	const handleCancelEditFullBio = () => {
		setEditedFullBio(boardMember?.fullBio || '');
		setIsEditingFullBio(false);
	};

	const handleEditBlogHtml = () => setIsEditingBlogHtml(true);
	const handleSaveBlogHtml = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, blogHtml: editedBlogHtml })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, blogHtml: editedBlogHtml });
					setSnackbarMessage('Blog URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update blog URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating blog URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingBlogHtml(false);
	};
	const handleCancelEditBlogHtml = () => {
		setEditedBlogHtml(boardMember?.blogHtml || '');
		setIsEditingBlogHtml(false);
	};

	const handleEditLinkedIn = () => setIsEditingLinkedIn(true);
	const handleSaveLinkedIn = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, lInkedinUrl: editedLinkedIn })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, lInkedinUrl: editedLinkedIn });
					setSnackbarMessage('LinkedIn URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update LinkedIn URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating LinkedIn URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingLinkedIn(false);
	};
	const handleCancelEditLinkedIn = () => {
		setEditedLinkedIn(boardMember?.lInkedinUrl || '');
		setIsEditingLinkedIn(false);
	};

	const handleEditGitHub = () => setIsEditingGitHub(true);
	const handleSaveGitHub = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, gitHubUrl: editedGitHub })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, gitHubUrl: editedGitHub });
					setSnackbarMessage('GitHub URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update GitHub URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating GitHub URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingGitHub(false);
	};
	const handleCancelEditGitHub = () => {
		setEditedGitHub(boardMember?.gitHubUrl || '');
		setIsEditingGitHub(false);
	};

	const handleEditTwitter = () => setIsEditingTwitter(true);
	const handleSaveTwitter = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, twitterUrl: editedTwitter })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, twitterUrl: editedTwitter });
					setSnackbarMessage('Twitter URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update Twitter URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating Twitter URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingTwitter(false);
	};
	const handleCancelEditTwitter = () => {
		setEditedTwitter(boardMember?.twitterUrl || '');
		setIsEditingTwitter(false);
	};

	const handleEditFacebook = () => setIsEditingFacebook(true);
	const handleSaveFacebook = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, faceboookUrl: editedFacebook })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, faceboookUrl: editedFacebook });
					setSnackbarMessage('Facebook URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update Facebook URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating Facebook URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingFacebook(false);
	};
	const handleCancelEditFacebook = () => {
		setEditedFacebook(boardMember?.faceboookUrl || '');
		setIsEditingFacebook(false);
	};

	const handleEditInstagram = () => setIsEditingInstagram(true);
	const handleSaveInstagram = async () => {
		if (boardMember) {
			try {
				const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...boardMember, instagramUrl: editedInstagram })
				});
				if (response.ok) {
					setBoardMember({ ...boardMember, instagramUrl: editedInstagram });
					setSnackbarMessage('Instagram URL updated successfully');
					setSnackbarSeverity('success');
				} else {
					setSnackbarMessage('Failed to update Instagram URL');
					setSnackbarSeverity('error');
				}
				setSnackbarOpen(true);
			} catch (error) {
				setSnackbarMessage('Error updating Instagram URL');
				setSnackbarSeverity('error');
				setSnackbarOpen(true);
			}
		}
		setIsEditingInstagram(false);
	};
	const handleCancelEditInstagram = () => {
		setEditedInstagram(boardMember?.instagramUrl || '');
		setIsEditingInstagram(false);
	};

	if (loading) {
		return (
			<Box sx={{ width: '100%', p: 3, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!boardMember) {
		return (
			<Box sx={{ width: '100%', p: 3 }}>
				<Typography variant="h4" sx={{ mb: 3 }}>
					Board Member Not Found
				</Typography>
			</Box>
		);
	}

	return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
				<Typography variant="h4">
					Board Member Details
				</Typography>
				<IconButton onClick={() => navigate('/admin/board')} sx={{ color: 'black' }}>
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
							src={boardMember.profileImageUrl ? `/${boardMember.profileImageUrl}` : undefined}
							alt={boardMember.name}
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
						{/* INFORMAZIONI BASE */}
						<Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
							<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
								Quick Info
							</Typography>
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
											<IconButton onClick={handleCancelEdit} color="error" size="small">
												<CancelIcon />
											</IconButton>
										</>
									) : (
										<>
											<Typography variant="h5" sx={{ flex: 1 }}>
												{boardMember.name}
											</Typography>
											<IconButton onClick={handleEditName} size="small" sx={{ ml: 1 }}>
												<EditIcon />
											</IconButton>
										</>
									)}
								</Box>
							</Box>
							<Grid container spacing={2} sx={{ mt: 1 }}>
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center' }}>
										<Typography variant="body2" sx={{ mr: 1, fontWeight: 600 }}>Order:</Typography>
										{isEditingOrder ? (
											<>
												<TextField
													value={editedOrder}
													onChange={(e) => {
														const value = parseInt(e.target.value) || 0;
														setEditedOrder(value < 0 ? 0 : value);
													}}
													variant="outlined"
													size="small"
													type="number"
													sx={{
														mr: 1,
														width: '80px',
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { min: 0 }
                                                    }}
												/>
												<IconButton onClick={handleSaveOrder} color="primary" size="small">
													<SaveIcon />
												</IconButton>
												<IconButton onClick={handleCancelEditOrder} color="error" size="small">
													<CancelIcon />
												</IconButton>
											</>
										) : (
											<>
												<Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>
													{boardMember.order}
												</Typography>
												<IconButton onClick={handleEditOrder} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 4
                                    }}>
									<FormControlLabel
										control={
											<Switch
												checked={boardMember.isActive}
												onChange={async (e) => {
													const newValue = e.target.checked;
													try {
														const response = await fetch(`${API_BASE_URL}/Board/Update/${boardMember.boardId}`, {
															method: 'PUT',
															headers: { 'Content-Type': 'application/json' },
															body: JSON.stringify({ ...boardMember, isActive: newValue })
														});
														if (response.ok) {
															setBoardMember({ ...boardMember, isActive: newValue });
															setSnackbarMessage('Visibility updated successfully');
															setSnackbarSeverity('success');
														} else {
															setSnackbarMessage('Failed to update visibility');
															setSnackbarSeverity('error');
														}
														setSnackbarOpen(true);
													} catch (error) {
														setSnackbarMessage('Error updating visibility');
														setSnackbarSeverity('error');
														setSnackbarOpen(true);
													}
												}}
												color="primary"
											/>
										}
										label="Visible"
									/>
								</Grid>
							</Grid>
							<Grid container spacing={2} sx={{ mt: 1 }}>
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 6
                                    }}>
									<Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Description (Role)</Typography>
									<Box sx={{ display: 'flex', alignItems: 'center' }}>
										{isEditingDescription ? (
											<>
												<TextField
													value={editedDescription}
													onChange={(e) => setEditedDescription(e.target.value)}
													variant="outlined"
													size="small"
													fullWidth
													placeholder="Insert description"
													sx={{
														mr: 1,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
												/>
												<IconButton onClick={handleSaveDescription} color="primary" size="small">
													<SaveIcon />
												</IconButton>
												<IconButton onClick={handleCancelEditDescription} color="error" size="small">
													<CancelIcon />
												</IconButton>
											</>
										) : (
											<>
												<Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
													{boardMember.description || 'Insert description'}
												</Typography>
												<IconButton onClick={handleEditDescription} size="small" sx={{ ml: 1 }}>
													<EditIcon />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>
								<Grid
                                    size={{
                                        xs: 12,
                                        md: 6
                                    }}>
									<Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Email</Typography>
									<Box sx={{ display: 'flex', alignItems: 'center' }}>
										{isEditingEmail ? (
											<>
												<TextField
													value={editedEmail}
													onChange={(e) => setEditedEmail(e.target.value)}
													variant="outlined"
													size="small"
													type="email"
													placeholder="Insert email"
													fullWidth
													sx={{
														mr: 1,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
												/>
												<IconButton onClick={handleSaveEmail} color="primary" size="small">
													<SaveIcon />
												</IconButton>
												<IconButton onClick={handleCancelEditEmail} color="error" size="small">
													<CancelIcon />
												</IconButton>
											</>
										) : (
											<>
												<Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
													{boardMember.email || 'Insert email'}
												</Typography>
												<IconButton onClick={handleEditEmail} size="small" sx={{ ml: 1 }}>
													<EditIcon />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>
							</Grid>
						</Paper>
						{/* BIOGRAFIA */}
						<Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
							<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
								Biography
							</Typography>
							{boardMember.role && (
								<Typography variant="body2" sx={{ mb: 1 }}>
									<strong>Role:</strong> {boardMember.role}
								</Typography>
							)}
							{boardMember.userName && (
								<Typography variant="body2" sx={{ mb: 2 }}>
									<strong>Username:</strong> {boardMember.userName}
								</Typography>
							)}
							<Box sx={{ mb: 2 }}>
								<Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Short Bio (Displayed on flip card)</Typography>
								<Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
									{isEditingShortBio ? (
										<>
											<TextField
												value={editedShortBio}
												onChange={(e) => setEditedShortBio(e.target.value)}
												variant="outlined"
												size="small"
												multiline
												rows={3}
												fullWidth
												placeholder="Insert short bio"
												sx={{
													mr: 1,
													'& .MuiOutlinedInput-root': {
														backgroundColor: '#fff',
														'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
													}
												}}
											/>
											<Box>
												<IconButton onClick={handleSaveShortBio} color="primary" size="small">
													<SaveIcon />
												</IconButton>
												<IconButton onClick={handleCancelEditShortBio} color="error" size="small">
													<CancelIcon />
												</IconButton>
											</Box>
										</>
									) : (
										<>
											<Typography variant="body2" sx={{ flex: 1 }}>
												{boardMember.shortBio || 'Insert short bio'}
											</Typography>
											<IconButton onClick={handleEditShortBio} size="small" sx={{ ml: 1 }}>
												<EditIcon />
											</IconButton>
										</>
									)}
								</Box>
							</Box>
							<Box>
								<Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Full Bio</Typography>
								<Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
									{isEditingFullBio ? (
										<>
											<TextField
												value={editedFullBio}
												onChange={(e) => setEditedFullBio(e.target.value)}
												variant="outlined"
												size="small"
												multiline
												rows={5}
												fullWidth
												placeholder="Insert full bio"
												sx={{
													mr: 1,
													'& .MuiOutlinedInput-root': {
														backgroundColor: '#fff',
														'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
													}
												}}
											/>
											<Box>
												<IconButton onClick={handleSaveFullBio} color="primary" size="small">
													<SaveIcon />
												</IconButton>
												<IconButton onClick={handleCancelEditFullBio} color="error" size="small">
													<CancelIcon />
												</IconButton>
											</Box>
										</>
									) : (
										<>
											<Typography variant="body1" sx={{ flex: 1 }}>
												{boardMember.fullBio || 'Insert full bio'}
											</Typography>
											<IconButton onClick={handleEditFullBio} size="small" sx={{ ml: 1 }}>
												<EditIcon />
											</IconButton>
										</>
									)}
								</Box>
							</Box>
						</Paper>

						{boardMember.profileBio && (
							<Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: '#fff3e0' }}>
								<Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600, color: '#e65100' }}>
									Profile Bio (Sistema)
								</Typography>
								<Typography variant="body2">
									{boardMember.profileBio}
								</Typography>
							</Paper>
						)}

						{/* BLOG & SOCIAL LINKS */}
						<Paper elevation={1} sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
							<Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
								Blog & Social Links
							</Typography>
							<Grid container spacing={2}>
								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<ArticleIcon sx={{ fontSize: 24, color: '#FF6B6B' }} />
										{isEditingBlogHtml ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedBlogHtml}
													onChange={(e) => setEditedBlogHtml(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert blog URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveBlogHtml} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditBlogHtml} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.blogHtml || 'Insert blog URL'}
												</Typography>
												<IconButton onClick={handleEditBlogHtml} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>

								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<LinkedInIcon sx={{ fontSize: 24, color: '#0077b5' }} />
										{isEditingLinkedIn ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedLinkedIn}
													onChange={(e) => setEditedLinkedIn(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert LinkedIn URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveLinkedIn} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditLinkedIn} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.lInkedinUrl || 'Insert LinkedIn URL'}
												</Typography>
												<IconButton onClick={handleEditLinkedIn} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>

								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<GitHubIcon sx={{ fontSize: 24, color: '#333' }} />
										{isEditingGitHub ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedGitHub}
													onChange={(e) => setEditedGitHub(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert GitHub URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveGitHub} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditGitHub} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.gitHubUrl || 'Insert GitHub URL'}
												</Typography>
												<IconButton onClick={handleEditGitHub} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>

								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<TwitterIcon sx={{ fontSize: 24, color: '#1DA1F2' }} />
										{isEditingTwitter ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedTwitter}
													onChange={(e) => setEditedTwitter(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert Twitter URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveTwitter} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditTwitter} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.twitterUrl || 'Insert Twitter URL'}
												</Typography>
												<IconButton onClick={handleEditTwitter} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>

								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<FacebookIcon sx={{ fontSize: 24, color: '#1877f2' }} />
										{isEditingFacebook ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedFacebook}
													onChange={(e) => setEditedFacebook(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert Facebook URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveFacebook} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditFacebook} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.faceboookUrl || 'Insert Facebook URL'}
												</Typography>
												<IconButton onClick={handleEditFacebook} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>
								<Grid
                                    size={{
                                        xs: 12,
                                        sm: 6,
                                        md: 4
                                    }}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<InstagramIcon sx={{ fontSize: 24, color: '#E4405F' }} />
										{isEditingInstagram ? (
											<Box sx={{ display: 'flex', alignItems: 'center' }}>
												<TextField
													value={editedInstagram}
													onChange={(e) => setEditedInstagram(e.target.value)}
													variant="outlined"
													size="small"
													placeholder="Insert Instagram URL"
													fullWidth
													sx={{
														mr: 0.5,
														'& .MuiOutlinedInput-root': {
															backgroundColor: '#fff',
															'& fieldset': { borderColor: 'primary.main', borderWidth: 2 }
														}
													}}
													slotProps={{
                                                        htmlInput: { maxLength: 150 }
                                                    }}
												/>
												<IconButton onClick={handleSaveInstagram} color="primary" size="small">
													<SaveIcon fontSize="small" />
												</IconButton>
												<IconButton onClick={handleCancelEditInstagram} color="error" size="small">
													<CancelIcon fontSize="small" />
												</IconButton>
											</Box>
										) : (
											<>
												<Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
													{boardMember.instagramUrl || 'Insert Instagram URL'}
												</Typography>
												<IconButton onClick={handleEditInstagram} size="small">
													<EditIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Box>
								</Grid>
							</Grid>
						</Paper>
					</Grid>
				</Grid>
			</Paper>
            <Snackbar
				open={snackbarOpen}
				autoHideDuration={3000}
				onClose={() => setSnackbarOpen(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			>
				<Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
					{snackbarMessage}
				</Alert>
			</Snackbar>
        </Box >
    );
};

export default AdminBoardDetail;

