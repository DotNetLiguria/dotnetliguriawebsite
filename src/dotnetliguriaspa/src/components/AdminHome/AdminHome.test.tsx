import React from 'react';
import { render, screen, makeWorkshop } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminHome from './AdminHome';
import { API_BASE_URL } from '../../config/apiConfig';
import { userProfileLocalStorageStore } from '../../store/userProfileLocalStorageStore';

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('<AdminHome />', () => {
  beforeEach(() => userProfileLocalStorageStore.setState({ profileSaved: true }));

  test('lists workshops and speakers with their counts', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => String(input).includes('/Speaker/')
      ? json([
          { workshopSpeakerId: 's1', name: 'Zeta Speaker', isActive: true, description: 'MVP' },
          { workshopSpeakerId: 's2', name: 'Alfa Speaker', isActive: false, description: '' },
        ])
      : json([
          makeWorkshop({ workshopId: 'w1', title: 'Old Event', eventDate: new Date('2023-01-01') }),
          makeWorkshop({ workshopId: 'w2', title: 'New Event', eventDate: new Date('2025-06-12'), published: false }),
        ]));

    render(<AdminHome pageName="Admin Dashboard" />, { route: '/admin' });

    expect(await screen.findByText('New Event')).toBeInTheDocument();
    expect(screen.getByText('Old Event')).toBeInTheDocument();
    expect(screen.getByText('Bozza')).toBeInTheDocument();
    expect(screen.getByText('1 pubblicati')).toBeInTheDocument();
    expect(screen.getByText('1 attivi')).toBeInTheDocument();
    const speakerNames = screen.getAllByText(/^(Alfa|Zeta) Speaker$/).map(e => e.textContent);
    expect(speakerNames).toEqual(['Alfa Speaker', 'Zeta Speaker']);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/Workshop/Get?onlyPublished=false`);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/Speaker/Get`);
  });

  test('shows an error when the server cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AdminHome />, { route: '/admin' });

    expect(await screen.findByText('Impossibile caricare workshop e speaker dal server.')).toBeInTheDocument();
  });
});
