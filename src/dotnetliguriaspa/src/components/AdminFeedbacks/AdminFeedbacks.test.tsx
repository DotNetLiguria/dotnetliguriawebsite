import React from 'react';
import { render, screen, mockJson, waitFor } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminFeedbacks from './AdminFeedbacks';
import userEvent from '@testing-library/user-event';
import { API_BASE_URL } from '../../config/apiConfig';

describe('<AdminFeedbacks />', () => {
  test('loads a feedback detail, displays notes, and closes it', async () => {
    mockJson([{ workshopId: 'event', title: 'Rated Workshop', date: '2024-03-15' }]);
    render(<AdminFeedbacks />);
    expect(await screen.findByText('Rated Workshop')).toBeInTheDocument();
    mockJson({ workshopId: 'event', workshopTitle: 'Rated Workshop', notes: ['Useful examples'], trackStatistics: [] });
    await userEvent.click(screen.getByRole('button', { name: 'View feedback' }));
    expect(await screen.findByText('Useful examples')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/GetFeedbackStatistics/event`);
    await userEvent.click(screen.getByRole('button', { name: 'Close feedback' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('reports failed summary loading instead of rendering successful rows', async () => {
    mockJson(null, 500);
    render(<AdminFeedbacks />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Errore HTTP: 500');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});