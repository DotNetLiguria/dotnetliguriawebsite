import React, { FC, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
   Container,
   Typography,
   Box,
   CircularProgress,
   Alert,
   Button,
   Card,
   CardContent,
   CardMedia,
   Chip,
   Stack,
   Grid,
   List,
   ListItem,
   ListItemText,
   ListItemIcon,
   Divider,
   Fab
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DownloadIcon from '@mui/icons-material/Download';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DescriptionIcon from '@mui/icons-material/Description';
import { WorkshopModel } from '../../models/WorkshopModel';
import { getWorkshopById } from '../../services/workShopService';
import { CONTENT_BASE_URL } from '../../config/apiConfig';
import HeroSection from '../HeroSection/HeroSection';
import styles from './WorkshopDetail.module.css';

export interface WorkshopDetailProps {
   pageName?: string;
}

const WorkshopDetail: FC<WorkshopDetailProps> = () => {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();
   const [workshop, setWorkshop] = useState<WorkshopModel | null>(null);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
   const [showScrollToTop, setShowScrollToTop] = useState(false);

   // Handle scroll to top visibility
   useEffect(() => {
      const handleScroll = () => {
         // Show button when user scrolls down more than 300px
         setShowScrollToTop(window.scrollY > 300);
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
   }, []);

   // Scroll to top function
   const scrollToTop = () => {
      window.scrollTo({
         top: 0,
         behavior: 'smooth'
      });
   };

   const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('it-IT', {
         year: 'numeric',
         month: 'long',
         day: 'numeric',
         weekday: 'long'
      });
   };

   const formatTime = (date: Date | string) => {
      // Convert to ISO string and extract time
      let dateStr = typeof date === 'string' ? date : new Date(date).toISOString();

      // If the date doesn't have a 'Z' suffix, the server is sending local time
      // We need to compensate for timezone offset to display the original time
      if (!dateStr.endsWith('Z')) {
         const localDate = new Date(dateStr);
         const utcTime = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);
         dateStr = utcTime.toISOString();
      }

      // Extract HH:MM from the ISO string
      return dateStr.substring(11, 16);
   };

   useEffect(() => {
      const fetchWorkshop = async () => {
         if (!id) {
            setError('No workshop ID provided');
            setLoading(false);
            return;
         }

         try {
            setLoading(true);
            setError(null);
            const workshopData = await getWorkshopById(id);
            setWorkshop(workshopData);
         } catch (err) {
            console.error('Error fetching workshop:', err);
            setError(err instanceof Error ? err.message : 'Failed to load workshop');
         } finally {
            setLoading(false);
         }
      };

      fetchWorkshop();
   }, [id]);

   const handleBackClick = () => {
      navigate('/workshops');
   };

   if (loading) {
      return (
         <Container maxWidth="lg" className={styles.container}>
            <Box     sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
               <CircularProgress size={60} />
            </Box>
         </Container>
      );
   }

   if (error) {
      return (
         <Container maxWidth="lg" className={styles.container}>
            <Box sx={{ mb: 3 }}>
               <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBackClick}
                  variant="outlined"
                  sx={{ mb: 2 }}
               >
                  Torna ai Workshops
               </Button>
            </Box>
            <Alert severity="error" sx={{ mb: 3 }}>
               {error}
            </Alert>
         </Container>
      );
   }

   if (!workshop) {
      return (
         <Container maxWidth="lg" className={styles.container}>
            <Alert severity="warning">
               Workshop not found
            </Alert>
         </Container>
      );
   }

   return (
      <>
         <HeroSection
            title={workshop.title}
            logoSrc="/images/logo-default.png"
            logoAlt="DotNet Liguria Logo"
         />
         <Container maxWidth="lg" className={styles.container}>
            <Grid container spacing={3}>
               {/* Main Content */}
               <Grid
                  size={{
                     xs: 12,
                     md: 8
                  }}>
                  <Card className={styles.workshopCard}>
                     {workshop.image && (
                        <CardMedia
                           component="img"
                           image={`${CONTENT_BASE_URL}${workshop.image.replace(/^\//, '')}`}
                           alt={workshop.title}
                           className={styles.workshopImage}
                           sx={{
                              height: 400,
                              objectFit: 'cover',
                              borderRadius: '8px 8px 0 0'
                           }}
                        />
                     )}

                     <CardContent className={styles.cardContent}>
                        {/* Header Section */}
                        <Box sx={{ mb: 4 }}>
                           <Typography variant="h4" component="h1" className={styles.workshopTitle} sx={{ mb: 2 }}>
                              {workshop.title}
                           </Typography>

                           <Box sx={{ mb: 3 }}>
                              <Stack direction="row" spacing={1}  sx={{ alignItems: "center", ...({ mb: 1 }) }}>
                                 <CalendarTodayIcon sx={{ color: '#72C02C', fontSize: '1.2rem' }} />
                                 <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '16px !important' }}>
                                    {formatDate(workshop.eventDate)}
                                 </Typography>
                              </Stack>

                              {workshop.location && (
                                 <Stack direction="row" spacing={1}  sx={{ alignItems: "center", ...({ mb: 2 }) }}>
                                    <LocationOnIcon sx={{ color: '#72C02C', fontSize: '1.2rem' }} />
                                    <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '16px !important' }}>
                                       {workshop.location.name} - {workshop.location.address}
                                    </Typography>
                                    {(workshop.location.googleMapsUrl || workshop.location.address) && (
                                       <Button
                                          href={workshop.location.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(workshop.location.address)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          size="small"
                                       >
                                          Open map
                                       </Button>
                                    )}
                                 </Stack>
                              )}

                              {(workshop.agendaTracks?.length ?? workshop.tracks?.length ?? 0) > 0 && (
                                 <Chip
                                    label={`${workshop.agendaTracks?.length ?? workshop.tracks?.length ?? 0} ${(workshop.agendaTracks?.length ?? workshop.tracks?.length ?? 0) === 1 ? 'Track' : 'Tracks'}`}
                                    sx={{
                                       backgroundColor: '#72C02C !important',
                                       color: '#ffffff !important',
                                       fontWeight: 600,
                                       '& .MuiChip-label': {
                                          color: '#ffffff !important'
                                       },
                                       '&:hover': {
                                          backgroundColor: '#5da024 !important'
                                       }
                                    }}
                                    size="medium"
                                 />
                              )}
                           </Box>
                        </Box>

                        {/* Description Section */}
                        <Box sx={{ mb: 4 }}>
                           <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                              Descrizione
                           </Typography>
                           <Typography
                              variant="body1"
                              className={styles.workshopDescription}
                              sx={{
                                 lineHeight: 1.8,
                                 fontSize: '1.1rem',
                                 color: 'text.secondary'
                              }}
                           >
                              {workshop.description}
                           </Typography>
                        </Box>

                        {/* Blog Content Section */}
                        {workshop.blogHtml && (
                           <Box sx={{ mb: 4 }}>
                              <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                 Workshop Details
                              </Typography>
                              <Box
                                 className={styles.blogContent}
                                 dangerouslySetInnerHTML={{ __html: workshop.blogHtml }}
                                 sx={{
                                    '& p': { mb: 2, lineHeight: 1.8 },
                                    '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 3, mb: 2 },
                                    '& ul, & ol': { pl: 3, mb: 2 },
                                    '& li': { mb: 1 }
                                 }}
                              />
                           </Box>
                        )}

                        {workshop.agendaItems && workshop.agendaItems.length > 0 && (
                           <Box sx={{ mb: 4 }}>
                              <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                 Agenda
                              </Typography>
                              <Stack spacing={2}>
                                 {[...workshop.agendaItems]
                                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                    .map(item => {
                                       const talk = workshop.talks?.find(value => value.workshopTalkId === item.talkId);
                                       const agendaTrack = workshop.agendaTracks?.find(value => value.workshopAgendaTrackId === item.trackId);
                                       const isTalk = item.itemType === 'talk' && talk;
                                       return (
                                          <Box key={item.workshopAgendaItemId} className={styles.trackItem}>
                                             <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {isTalk ? talk.title : item.title || (item.itemType === 'service' ? 'Service break' : 'Interval')}
                                             </Typography>
                                             <Typography variant="subtitle2" sx={{ mb: 1, color: '#666' }}>
                                                {formatTime(item.startTime)} - {formatTime(item.endTime)}
                                                {agendaTrack ? ` · ${agendaTrack.name}` : ' · All tracks'}
                                                {item.roomName ? ` · ${item.roomName}` : ''}
                                                {isTalk && talk.sessionType ? ` · ${talk.sessionType}` : ''}
                                             </Typography>
                                             {isTalk && talk.abstract && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.6 }}>
                                                   {talk.abstract}
                                                </Typography>
                                             )}
                                             {isTalk && talk.speakers.length > 0 && (
                                                <Stack spacing={1}>
                                                   {talk.speakers.map((speaker, index) => (
                                                      <Stack key={speaker.workshopSpeakerId ?? speaker.sessionizeId ?? `${speaker.name}-${index}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                         {speaker.imageUrl && (
                                                            <Box component="img" src={speaker.imageUrl} alt={speaker.name} sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                         )}
                                                         <Box>
                                                            <Typography variant="subtitle2">{speaker.name}</Typography>
                                                            {speaker.biography && <Typography variant="caption" color="text.secondary">{speaker.biography}</Typography>}
                                                         </Box>
                                                      </Stack>
                                                   ))}
                                                </Stack>
                                             )}
                                          </Box>
                                       );
                                    })}
                              </Stack>
                           </Box>
                        )}

                        {workshop.attendeeNotes && (
                           <Box sx={{ mb: 4 }}>
                              <Typography variant="h5" component="h2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                 Notes for attendees
                              </Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{workshop.attendeeNotes}</Typography>
                           </Box>
                        )}

                        {(workshop.bookingServiceUrl || workshop.externalRegistrationLink) && (
                           <Box sx={{ textAlign: 'center', mt: 4 }}>
                              <Button
                                 variant="contained"
                                 size="large"
                                 href={workshop.bookingServiceUrl || workshop.externalRegistrationLink}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 sx={{ px: 4, py: 2 }}
                              >
                                 Book or cancel a seat
                              </Button>
                           </Box>
                        )}

                        {/* Tracks Section */}
                        {workshop.tracks && workshop.tracks.length > 0 && (
                           <Box sx={{ mb: 4 }}>
                              <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                 Tracks
                              </Typography>
                              <Stack spacing={2}>
                                 {workshop.tracks
                                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                    .map((track, index) => (
                                       <Box key={index} className={styles.trackItem}>
                                          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, fontSize: '20px' }}>
                                             Track {index + 1}: {track.title || `Track ${index + 1}`}
                                          </Typography>

                                          {/* Track Time Information */}
                                          {track.startTime && track.endTime && (
                                             <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium', color: '#666', display: 'flex', alignItems: 'center', gap: 1, fontSize: '16px' }}>
                                                🕒 {formatTime(track.startTime)} - {formatTime(track.endTime)}
                                             </Typography>
                                          )}

                                          {track.speakersName && (
                                             <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium', color: '#1976d2', fontSize: '18px' }}>
                                                Speaker: {track.speakersName}
                                             </Typography>
                                          )}
                                          {track.abstract && (
                                             <Typography variant="body2" color="text.secondary" sx={{ fontSize: '16px', lineHeight: 1.6 }}>
                                                {track.abstract}
                                             </Typography>
                                          )}
                                       </Box>
                                    ))}
                              </Stack>
                           </Box>
                        )}

                        {/* Tags Section */}
                        {workshop.tags && (
                           <Box sx={{ mb: 4 }}>
                              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                                 Tags
                              </Typography>
                              <Stack direction="row" spacing={1}  sx={{ flexWrap: "wrap" }}>
                                 {workshop.tags.split(',').map((tag, index) => (
                                    <Chip
                                       key={index}
                                       label={tag.trim()}
                                       size="small"
                                       variant="outlined"
                                    />
                                 ))}
                              </Stack>
                           </Box>
                        )}

                        {/* Registration Section */}
                        {/* {workshop.externalRegistration && workshop.externalRegistrationLink && (
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                     <Button
                        variant="contained"
                        size="large"
                        href={workshop.externalRegistrationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ px: 4, py: 2 }}
                     >
                        Register for Workshop
                     </Button>
                  </Box>
               )} */}
                     </CardContent>
                  </Card>
               </Grid>

               {/* Right Sidebar */}
               <Grid
                  size={{
                     xs: 12,
                     md: 4
                  }}>
                  {/* Back Button */}
                  <Box sx={{ mb: 3 }}>
                     <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBackClick}
                        variant="outlined"
                        sx={{ mb: 2, width: '100%' }}
                     >
                        Torna ai Workshops
                     </Button>
                  </Box>

                  {/* Downloads Section */}
                  {workshop.materials && workshop.materials.length > 0 && (
                     <Card className={styles.sidebarCard} sx={{ mb: 3 }}>
                        <CardContent>
                           <Typography variant="h6" component="h3" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <DownloadIcon color="primary" />
                              Downloads
                           </Typography>
                           <Divider sx={{ mb: 2 }} />
                           <List dense>
                              {workshop.materials.map((material, index) => (
                                 <ListItem
                                    key={index}
                                    className={styles.downloadItem}
                                    sx={{ px: 0 }}
                                 >
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                       <DescriptionIcon color="action" />
                                    </ListItemIcon>
                                    <ListItemText
                                       primary={
                                          <Button
                                             component="a"
                                             href={material.fullPath}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             variant="text"
                                             size="small"
                                             className={styles.downloadButton}
                                             sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                          >
                                             {material.title || material.fileName}
                                          </Button>
                                       }
                                       secondary={material.fileName !== material.title ? material.fileName : undefined}
                                    />
                                 </ListItem>
                              ))}
                           </List>
                        </CardContent>
                     </Card>
                  )}

                  {/* Photos Section */}
                  {workshop.photos && workshop.photos.length > 0 && (
                     <Card className={styles.sidebarCard}>
                        <CardContent>
                           <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                              Foto del Workshop
                           </Typography>
                           <Divider sx={{ mb: 2 }} />
                           <Stack spacing={1}>
                              {workshop.photos.slice(0, 5).map((photo, index) => (
                                 <Button
                                    key={index}
                                    component="a"
                                    href={photo.fullPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="text"
                                    size="small"
                                    className={styles.downloadButton}
                                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                 >
                                    {photo.title || `Foto ${index + 1}`}
                                 </Button>
                              ))}
                              {workshop.photos.length > 5 && (
                                 <Typography variant="caption" color="text.secondary">
                                    +{workshop.photos.length - 5} altre foto
                                 </Typography>
                              )}
                           </Stack>
                        </CardContent>
                     </Card>
                  )}
               </Grid>
            </Grid>

            {/* Google Maps Section */}
            {workshop.location && (workshop.location.coordinates || workshop.location.address || workshop.location.googleMapsUrl) && (
               <Box sx={{ mt: 4, mb: 4 }}>
                  <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 'bold' }}>
                     Sede dell&apos;evento
                  </Typography>
                  <Box
                     component="iframe"
                     src={workshop.location.googleMapsUrl?.includes('/maps/embed')
                        ? workshop.location.googleMapsUrl
                        : `https://maps.google.com/maps?q=${encodeURIComponent(workshop.location.address || workshop.location.coordinates || '')}&output=embed&z=17`}
                     sx={{
                        width: '100%',
                        height: '450px',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                     }}
                     title="Workshop Location"
                     loading="lazy"
                  />
               </Box>
            )}
         </Container>

         {/* Scroll to Top Button */}
         {showScrollToTop && (
            <Fab
               onClick={scrollToTop}
               color="primary"
               aria-label="scroll to top"
               sx={{
                  position: 'fixed',
                  bottom: 32,
                  right: 32,
                  zIndex: 9999,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  width: 56,
                  height: 56,
                  '&:hover': {
                     boxShadow: '0 6px 25px rgba(0,0,0,0.4)',
                     backgroundColor: '#1565c0',
                     transform: 'scale(1.1)',
                  },
                  transition: 'all 0.3s ease-in-out'
               }}
            >
               <KeyboardArrowUpIcon sx={{ fontSize: 28 }} />
            </Fab>
         )}
      </>
   );
};

export default WorkshopDetail;
