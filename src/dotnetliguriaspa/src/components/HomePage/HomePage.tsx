import React, { useState, useEffect } from 'react';
import './HomePage.css';
import { Container, Typography, Box, IconButton, Alert } from '@mui/material';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import InstagramIcon from '@mui/icons-material/Instagram';
import ArticleIcon from '@mui/icons-material/Article';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { CONTENT_BASE_URL, API_BASE_URL } from '../../config/apiConfig';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TopBar from '../TopBar/TopBar';
import Footer from '../Footer/Footer';
import HeroSection from '../HeroSection/HeroSection';
import { getActiveBoardProfiles } from '../../services/boardProfileService';
import { BoardProfileModel } from '../../models/BoadProfileModel';

interface WorkshopTrack {
    workshopTrackId: string;
    title: string;
    startTime: string;
    endTime: string;
    abstract: string;
    speakersName: string;
}

interface WorkshopLocation {
    name: string;
    coordinates: string;
    address: string;
}

interface HomePageWorkshop {
    workshopId: string;
    title: string;
    eventDate: string;
    image: string;
    location: WorkshopLocation;
    tracks: WorkshopTrack[];
}

interface TeamMember {
    name: string;
    title: string;
    image: string;
    description: string;
    shortBio?: string;
    blogUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
}

function TeamMemberCard({ member }: { member: TeamMember }) {
    const [showDescription, setShowDescription] = useState(false);

    return (
        <div className="flip-card">
            <div
                className={`flip-card-inner ${showDescription ? 'flipped' : ''}`}
                onClick={() => setShowDescription(!showDescription)}
            >
                {/* Front side */}
                <div className="flip-card-front">
                    <img
                        src={member.image}
                        alt={member.name}
                        style={{
                            width: 205,
                            height: 205,
                            minHeight: 205,
                            maxHeight: 205,
                            borderRadius: '8px',
                            marginBottom: 12,
                            objectFit: 'cover',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            display: 'block',
                        }}
                    />
                    <Typography variant="h6" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, fontSize: '1.25rem', marginBottom: 1 }}>
                        {member.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'Titillium Web', sans-serif", color: '#666', marginBottom: 1 }}>
                        {member.title}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5, marginTop: 'auto' }}>
                        <IconButton
                            size="small"
                            component={member.blogUrl ? "a" : "button"}
                            href={member.blogUrl || undefined}
                            target={member.blogUrl ? "_blank" : undefined}
                            rel={member.blogUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.blogUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <ArticleIcon sx={{ fontSize: 20, color: member.blogUrl ? '#FF6B6B' : '#ccc' }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            component={member.linkedinUrl ? "a" : "button"}
                            href={member.linkedinUrl || undefined}
                            target={member.linkedinUrl ? "_blank" : undefined}
                            rel={member.linkedinUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.linkedinUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <LinkedInIcon sx={{ fontSize: 20, color: member.linkedinUrl ? '#0077B5' : '#ccc' }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            component={member.githubUrl ? "a" : "button"}
                            href={member.githubUrl || undefined}
                            target={member.githubUrl ? "_blank" : undefined}
                            rel={member.githubUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.githubUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <GitHubIcon sx={{ fontSize: 20, color: member.githubUrl ? '#333' : '#ccc' }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            component={member.facebookUrl ? "a" : "button"}
                            href={member.facebookUrl || undefined}
                            target={member.facebookUrl ? "_blank" : undefined}
                            rel={member.facebookUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.facebookUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <FacebookIcon sx={{ fontSize: 20, color: member.facebookUrl ? '#1877F2' : '#ccc' }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            component={member.twitterUrl ? "a" : "button"}
                            href={member.twitterUrl || undefined}
                            target={member.twitterUrl ? "_blank" : undefined}
                            rel={member.twitterUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.twitterUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <TwitterIcon sx={{ fontSize: 20, color: member.twitterUrl ? '#1DA1F2' : '#ccc' }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            component={member.instagramUrl ? "a" : "button"}
                            href={member.instagramUrl || undefined}
                            target={member.instagramUrl ? "_blank" : undefined}
                            rel={member.instagramUrl ? "noopener" : undefined}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            disabled={!member.instagramUrl}
                            sx={{ padding: 0.5 }}
                        >
                            <InstagramIcon sx={{ fontSize: 20, color: member.instagramUrl ? '#E4405F' : '#ccc' }} />
                        </IconButton>
                    </Box>
                </div>

                {/* Back side */}
                <div className="flip-card-back">
                    <Typography variant="h6" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, fontSize: '1.25rem', marginBottom: 2 }}>
                        {member.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'Titillium Web', sans-serif", fontSize: '1rem', textAlign: 'center', color: '#333' }}>
                        {member.shortBio || member.description}
                    </Typography>
                </div>
            </div>
        </div>
    );
}

export default function Home() {
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [workshop, setWorkshop] = useState<HomePageWorkshop | null>(null);
    const [workshopLoading, setWorkshopLoading] = useState(true);
    const [workshopError, setWorkshopError] = useState<string | null>(null);

    useEffect(() => {
        const loadWorkshop = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/Workshop/GetInHomePage/HomePage`);
                if (response.status === 404) {
                    setWorkshop(null);
                    return;
                }
                if (!response.ok) {
                    throw new Error(`Errore HTTP: ${response.status}`);
                }
                const data = await response.json();
                setWorkshop(data);
            } catch (error) {
                console.error('Error loading workshop:', error);
                setWorkshopError(error instanceof Error ? error.message : "Errore nel caricamento dell'evento");
            } finally {
                setWorkshopLoading(false);
            }
        };

        loadWorkshop();
    }, []);

    useEffect(() => {
        const loadTeamMembers = async () => {
            try {
                const boardProfiles = await getActiveBoardProfiles();
                const members: TeamMember[] = boardProfiles
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((profile: BoardProfileModel) => ({
                        name: profile.name,
                        title: profile.description || '',
                        image: profile.profileImageUrl ? `${CONTENT_BASE_URL}${profile.profileImageUrl.replace(/^\//, '')}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=ccc&color=fff&size=300`,
                        description: profile.profileBio || '',
                        shortBio: profile.shortBio,
                        blogUrl: profile.blogHtml,
                        linkedinUrl: profile.lInkedinUrl,
                        githubUrl: profile.gitHubUrl,
                        facebookUrl: profile.faceboookUrl,
                        twitterUrl: profile.twitterUrl,
                        instagramUrl: profile.instagramUrl
                    }));
                setTeamMembers(members);
            } catch (error) {
                console.error('Error loading team members:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTeamMembers();
    }, []);

    return (
        <>
            <TopBar showMenu={true} />
            <main className="home-container">
                <HeroSection
                    title="La prima community .NET della Liguria"
                    logoSrc="/images/logo-default.png"
                    logoAlt="DotNet Liguria Logo"
                />
                <section className="about fullscreen-section" id="about">
                    <div className="section-content" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', px: 4 }}>
                                <Typography variant="body1" align="center" sx={{ fontFamily: "'Titillium Web', sans-serif", fontSize: '1.25rem', width: '100%' }}>
                                    DotNet Liguria è la prima community .NET della Liguria, nata per promuovere la condivisione di conoscenze, esperienze e networking tra sviluppatori, professionisti e appassionati del mondo Microsoft .NET. Organizziamo eventi, workshop e incontri per favorire la crescita tecnica e la collaborazione sul territorio.
                                </Typography>
                            </Box>
                        </Box>
                    </div>
                </section>
                <section className="dotnet-conf fullscreen-section" id="evidence">
                    {workshopLoading ? (
                        <Container maxWidth={false} className="section-content" style={{ padding: '0 4rem', paddingTop: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Typography variant="body1" sx={{ fontFamily: "'Titillium Web', sans-serif" }}>
                                Caricamento evento...
                            </Typography>
                        </Container>
                    ) : workshopError ? (
                        <Alert severity="error">{workshopError}</Alert>
                    ) : workshop ? (
                        <Container maxWidth={false} className="section-content" style={{ padding: '0 4rem', paddingTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="h2" align="center" gutterBottom sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, marginTop: 0, marginBottom: 3, width: '100%' }}>
                                {workshop.title}
                            </Typography>
                            <Box sx={{ marginBottom: 3 }}>
                                <img
                                    src={`${CONTENT_BASE_URL}${workshop.image.replace(/^\//, '')}`}
                                    alt={workshop.title}
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CalendarTodayIcon sx={{ color: '#72C02C' }} />
                                    <Typography variant="body1" sx={{ fontFamily: "'Titillium Web', sans-serif", fontSize: '24px' }}>
                                        {new Date(workshop.eventDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BusinessIcon sx={{ color: '#72C02C' }} />
                                    <Typography variant="body1" sx={{ fontFamily: "'Titillium Web', sans-serif", fontSize: '24px' }}>
                                        {workshop.location.name}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: '-8px' }}>
                                    <LocationOnIcon sx={{ color: '#72C02C' }} />
                                    <Typography variant="body1" sx={{ fontFamily: "'Titillium Web', sans-serif", fontSize: '24px', color: '#444' }}>
                                        {workshop.location.address}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ marginTop: 4, width: '100%' }}>
                                <Typography variant="h4" align="center" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, marginBottom: 3 }}>
                                    Programma
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {workshop.tracks.map((track) => (
                                        <Box key={track.workshopTrackId} sx={{ padding: 2, backgroundColor: '#f5f5f5', borderRadius: '8px', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
                                            <Typography variant="h6" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, fontSize: '1.6rem' }}>
                                                {track.speakersName}
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontFamily: "'Titillium Web', sans-serif", color: '#666', marginBottom: 1, fontSize: '1.35rem' }}>
                                                {new Date(track.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - {new Date(track.endTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                            <Typography variant="subtitle1" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, marginTop: 1, marginBottom: 1, fontSize: '1.35rem' }}>
                                                {track.title}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontFamily: "'Titillium Web', sans-serif", textAlign: 'justify', fontSize: '1.22rem' }}>
                                                {track.abstract}
                                            </Typography>
                                        </Box>
                                    ))}
                                    <Box sx={{ marginTop: 4, width: '100%', maxWidth: '900px', margin: '2rem auto 0' }}>
                                        <iframe
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(workshop.location.address)}&output=embed&z=17`}
                                            width="100%"
                                            height="400"
                                            style={{ border: 0, borderRadius: '8px' }}
                                            allowFullScreen
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            title={workshop.location.address}
                                        ></iframe>
                                    </Box>
                                </Box>
                            </Box>
                        </Container>
                    ) : (
                        <Typography variant="body1" align="center">
                            Nessun evento disponibile.
                        </Typography>
                    )}
                </section>
                <section className="board fullscreen-section" id="team">
                    <div className="section-content" style={{ flexDirection: 'column', paddingTop: '30px', paddingBottom: '50px' }}>
                        <Typography variant="h3" align="center" sx={{ fontFamily: "'Titillium Web', sans-serif", fontWeight: 600, marginBottom: 3, width: '100%' }}>
                            Il Team
                        </Typography>
                        {loading ? (
                            <Typography variant="body1" align="center" sx={{ fontFamily: "'Titillium Web', sans-serif", color: '#666' }}>
                                Caricamento...
                            </Typography>
                        ) : teamMembers.length === 0 ? (
                            <Typography variant="body1" align="center" sx={{ fontFamily: "'Titillium Web', sans-serif", color: '#666' }}>
                                Nessun membro del team disponibile
                            </Typography>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
                                    {teamMembers.slice(0, 4).map(member => (
                                        <TeamMemberCard key={member.name} member={member} />
                                    ))}
                                </div>
                                {teamMembers.length > 4 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
                                        {teamMembers.slice(4).map(member => (
                                            <TeamMemberCard key={member.name} member={member} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
                <Footer />
            </main>
        </>
    );
}
