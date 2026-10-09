import React, { FC, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, IconButton, Dialog, DialogTitle, DialogContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE_URL } from '../../config/apiConfig';

interface WorkshopFeedbackSummary {
  workshopId: string;
  title: string;
  date: string;
}

interface TrackStatistic {
  workshopTrackId: string;
  trackTitle: string;
  ratingDistribution: { [key: string]: number };
  totalFeedbacks: number;
  averageRating: number;
}

interface FeedbackDetail {
  workshopId: string;
  workshopTitle: string;
  trackStatistics: TrackStatistic[];
  notes: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminFeedbacksProps { pageName?: string }

const AdminFeedbacks: FC<AdminFeedbacksProps> = () => {
  const [feedbacks, setFeedbacks] = useState<WorkshopFeedbackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedbackDetail, setFeedbackDetail] = useState<FeedbackDetail | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const loadFeedbacks = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/Workshop/GetWorkshopsWithFeedback/Summary`);

        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = await response.json();
        setFeedbacks(data);
      } catch (err) {
        console.error('Error loading feedbacks:', err);
        setError(err instanceof Error ? err.message : 'Errore nel caricamento dei feedback');
      } finally {
        setLoading(false);
      }
    };

    loadFeedbacks();
  }, []);

  const handleViewDetail = async (workshopId: string, date: string) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      setSelectedDate(date);
      const response = await fetch(`${API_BASE_URL}/Workshop/GetFeedbackStatistics/${workshopId}`);

      if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log('Feedback detail ricevuto:', data);
      console.log('Note presenti:', data.notes);
      setFeedbackDetail(data);
    } catch (err) {
      console.error('Error loading feedback detail:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento del dettaglio');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setFeedbackDetail(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Workshop',
      flex: 2,
      minWidth: 200
    },
    {
      field: 'date',
      headerName: 'Data',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'actions',
      headerName: 'Azioni',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          aria-label="View feedback"
          onClick={() => handleViewDetail(params.row.workshopId, params.row.date)}
          size="small"
          sx={{
            backgroundColor: '#648B2D',
            color: 'white',
            padding: '4px',
            '&:hover': {
              backgroundColor: '#527023'
            }
          }}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      )
    }
  ];

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Feedbacks
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={feedbacks}
            columns={columns}
            getRowId={(row) => row.workshopId}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 }
              }
            }}
          />
        </Box>
      )}

      <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" component="div">
              Feedback detail - {feedbackDetail?.workshopTitle || ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Data: {selectedDate}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close feedback"
            onClick={handleCloseDetail}
            size="small"
            sx={{ color: 'grey.500' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {detailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {!detailLoading && feedbackDetail && (
            <>
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Track</TableCell>
                      <TableCell align="center">Feedbacks</TableCell>
                      <TableCell align="center">Media</TableCell>
                      <TableCell align="center">1★</TableCell>
                      <TableCell align="center">2★</TableCell>
                      <TableCell align="center">3★</TableCell>
                      <TableCell align="center">4★</TableCell>
                      <TableCell align="center">5★</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {feedbackDetail.trackStatistics.map((track) => {
                      return (
                        <TableRow key={track.workshopTrackId}>
                          <TableCell>{track.trackTitle}</TableCell>
                          <TableCell align="center">{track.totalFeedbacks}</TableCell>
                          <TableCell align="center">{track.averageRating.toFixed(2)}</TableCell>
                          <TableCell align="center">{track.ratingDistribution['1'] || 0}</TableCell>
                          <TableCell align="center">{track.ratingDistribution['2'] || 0}</TableCell>
                          <TableCell align="center">{track.ratingDistribution['3'] || 0}</TableCell>
                          <TableCell align="center">{track.ratingDistribution['4'] || 0}</TableCell>
                          <TableCell align="center">{track.ratingDistribution['5'] || 0}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {feedbackDetail.notes && feedbackDetail.notes.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Note:
                  </Typography>
                  {feedbackDetail.notes.map((note, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <Typography variant="body2">{note}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AdminFeedbacks;
