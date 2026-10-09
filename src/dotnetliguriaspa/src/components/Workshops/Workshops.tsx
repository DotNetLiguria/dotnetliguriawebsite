import React, { FC, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Stack, Typography, Fab, ToggleButton, ToggleButtonGroup } from "@mui/material";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getWorkshops, getWorkshopsByYear } from '../../services/workShopService';
import { WorkshopModel } from '../../models/WorkshopModel';
import WorkshopItem from '../WorkshopItem/WorkshopItem';
import HeroSection from '../HeroSection/HeroSection';
import './Workshops.css';

interface WorkshopsProps { pageName: string }

//eslint-disable-next-line @typescript-eslint/no-unused-vars
const Workshops: FC<WorkshopsProps> = ({ pageName }) => {

  const [workshops, setWorkShops] = React.useState<WorkshopModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [availableYears, setAvailableYears] = React.useState<number[]>([]);
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
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

  // Extract unique years from workshops
  const extractYears = (workshopsData: WorkshopModel[]): number[] => {
    const years = workshopsData.map(workshop => new Date(workshop.eventDate).getFullYear());
    return Array.from(new Set(years)).sort((a, b) => b - a); // Sort descending (newest first)
  };

  const fetchAllWorkshops = async () => {
    try {
      setLoading(true);
      setError(null);
      const workshopsData = await getWorkshops();
      setWorkShops(workshopsData);
      const years = extractYears(workshopsData);
      setAvailableYears(years);
    } catch (error) {
      console.error("Failed to fetch workshops:", error);
      setError("Failed to load workshops. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshopsByYear = async (year: number) => {
    try {
      setLoading(true);
      setError(null);
      const workshopsData = await getWorkshopsByYear(year);
      setWorkShops(workshopsData);
    } catch (error) {
      console.error("Failed to fetch workshops by year:", error);
      setError("Failed to load workshops for the selected year. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleYearFilter = (year: number | null) => {
    setSelectedYear(year);
    if (year === null) {
      fetchAllWorkshops();
    } else {
      fetchWorkshopsByYear(year);
    }
  };

  const handleYearChange = (_event: React.MouseEvent<HTMLElement>, newYear: number | null) => {
    if (newYear !== null) {
      handleYearFilter(newYear);
    }
  };

  useEffect(() => {
    fetchAllWorkshops();
  }, []);


  return (
    <>
      <HeroSection
        title="Eventi Passati"
        logoSrc="/images/logo-default.png"
        logoAlt="DotNet Liguria Logo"
      />

      {/* Main Content Section with Green Gradient Background */}
      <section className="workshops-filter fullscreen-section">
        <div className="section-content">
          {/* Year Filter Bar - Full Width */}
          {!loading && !error && workshops.length > 0 && availableYears.length > 1 && (
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 3,
              mb: 4,
              width: '100%'
            }}>
              <ToggleButtonGroup
                value={selectedYear}
                exclusive
                onChange={handleYearChange}
                aria-label="year filter"
                sx={{
                  '& .MuiToggleButton-root': {
                    color: '#2d5016',
                    borderColor: '#2d5016',
                    fontWeight: 600,
                    px: 3,
                    py: 1,
                    fontSize: '1rem',
                    '&.Mui-selected': {
                      backgroundColor: '#2d5016',
                      color: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#3d6020',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(45, 80, 22, 0.1)',
                    },
                  },
                }}
              >
                {availableYears.map((year) => (
                  <ToggleButton key={year} value={year}>
                    {year}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <ToggleButton
                value="all"
                selected={selectedYear === null}
                onChange={() => handleYearFilter(null)}
                sx={{
                  color: selectedYear === null ? '#ffffff !important' : '#2d5016',
                  backgroundColor: selectedYear === null ? '#2d5016 !important' : 'transparent',
                  borderColor: '#2d5016 !important',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  fontSize: '1rem',
                  '&:hover': {
                    backgroundColor: selectedYear === null ? '#3d6020 !important' : 'rgba(45, 80, 22, 0.1)',
                  },
                }}
              >
                Tutti gli anni
              </ToggleButton>
            </Box>
          )}

          {/* Workshops Content - Constrained Width */}
          <Container component={"div"} maxWidth={false} sx={{
            "padding-top": 0,
            "padding-bottom": 4,
            maxWidth: '1400px',
            width: '100%',
            margin: '0 auto'
          }}>
            {loading && (
              <Box     sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ ml: 2 }}>
                  Loading workshops ...
                </Typography>
              </Box>
            )}

            {/* Error state */}
            {error && !loading && (
              <Box   sx={{ display: "flex", justifyContent: "center", ...({ mt: 4 }) }}>
                <Alert severity="error" sx={{ maxWidth: 600 }}>
                  {error}
                </Alert>
              </Box>
            )}

            {!loading && !error && workshops.length > 0 && (
              <Stack spacing={3}>
                {workshops.map((workshop) => (
                  <WorkshopItem key={workshop.workshopId} workshop={workshop} />
                ))}
              </Stack>
            )}

            {/* No workshops found */}
            {!loading && !error && workshops.length === 0 && (
              <Box   sx={{ display: "flex", justifyContent: "center", ...({ mt: 4 }) }}>
                <Typography variant="h6" color="text.secondary">
                  Nessun workshop trovato.
                </Typography>
              </Box>
            )}

          </Container>
        </div>
      </section>

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
  )
};

export default Workshops;
