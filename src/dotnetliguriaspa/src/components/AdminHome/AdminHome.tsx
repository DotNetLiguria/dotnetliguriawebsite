import React, { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOidcFetch } from '@axa-fr/react-oidc';
import {
    Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, List,
    ListItemButton, ListItemText, Paper, Typography,
} from '@mui/material';
import { userProfileLocalStorageStore } from "../../store/userProfileLocalStorageStore";
import { API_BASE_URL } from '../../config/apiConfig';
import { WorkshopModel } from '../../models/WorkshopModel';
import SpeakerModel from '../../models/SpeakerModel';

interface AdminHomeProps { pageName?: string }

const recentWorkshopCount = 5;

const AdminHome: FC<AdminHomeProps> = () => {
    const profileSaved = userProfileLocalStorageStore((state) => state.profileSaved);
    const { fetch } = useOidcFetch();
    const navigate = useNavigate();
    const [workshops, setWorkshops] = useState<WorkshopModel[]>([]);
    const [speakers, setSpeakers] = useState<SpeakerModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!profileSaved) {
            window.location.replace('/admin/profile/');
        }
    }, [profileSaved]);

    useEffect(() => {
        const load = async () => {
            try {
                const [workshopResponse, speakerResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/Workshop/Get?onlyPublished=false`),
                    fetch(`${API_BASE_URL}/Speaker/Get`),
                ]);
                if (!workshopResponse.ok || !speakerResponse.ok) {
                    throw new Error(`HTTP ${workshopResponse.status}/${speakerResponse.status}`);
                }
                setWorkshops(await workshopResponse.json());
                setSpeakers(await speakerResponse.json());
            } catch (e) {
                console.error('Error loading dashboard:', e);
                setError('Impossibile caricare workshop e speaker dal server.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetch]);

    const recentWorkshops = [...workshops]
        .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
        .slice(0, recentWorkshopCount);
    const sortedSpeakers = [...speakers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    const publishedCount = workshops.filter(w => w.published).length;
    const activeSpeakerCount = speakers.filter(s => s.isActive).length;

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>
                Admin Dashboard
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {loading ? <CircularProgress aria-label="Caricamento" /> : (
                <>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 3 }}>
                        <Card>
                            <CardActionArea onClick={() => navigate('/admin/workshops/')}>
                                <CardContent>
                                    <Typography color="text.secondary">Workshop</Typography>
                                    <Typography variant="h3">{workshops.length}</Typography>
                                    <Typography variant="body2">{publishedCount} pubblicati</Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                        <Card>
                            <CardActionArea onClick={() => navigate('/admin/speakers/')}>
                                <CardContent>
                                    <Typography color="text.secondary">Speaker</Typography>
                                    <Typography variant="h3">{speakers.length}</Typography>
                                    <Typography variant="body2">{activeSpeakerCount} attivi</Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Box>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                        <Paper sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6">Ultimi workshop</Typography>
                                <Button onClick={() => navigate('/admin/workshops/')}>Tutti i workshop</Button>
                            </Box>
                            {recentWorkshops.length === 0 ? <Typography color="text.secondary">Nessun workshop.</Typography> : (
                                <List dense>
                                    {recentWorkshops.map(w => (
                                        <ListItemButton key={w.workshopId} onClick={() => navigate(`/admin/workshop/${w.workshopId}`)}>
                                            <ListItemText
                                                primary={w.title}
                                                secondary={w.eventDate ? new Date(w.eventDate).toLocaleDateString('it-IT') : ''} />
                                            {!w.published && <Chip size="small" label="Bozza" />}
                                        </ListItemButton>
                                    ))}
                                </List>
                            )}
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6">Speaker</Typography>
                                <Button onClick={() => navigate('/admin/speakers/')}>Tutti gli speaker</Button>
                            </Box>
                            {sortedSpeakers.length === 0 ? <Typography color="text.secondary">Nessuno speaker.</Typography> : (
                                <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
                                    {sortedSpeakers.map(s => (
                                        <ListItemButton key={s.workshopSpeakerId} onClick={() => navigate(`/admin/speakers/${s.workshopSpeakerId}`)}>
                                            <ListItemText primary={s.name} secondary={s.description} />
                                            {!s.isActive && <Chip size="small" label="Non attivo" />}
                                        </ListItemButton>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default AdminHome;
