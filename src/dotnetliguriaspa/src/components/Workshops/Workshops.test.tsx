import React from 'react';
import { render, screen, within, makeWorkshop, mockJson, waitFor } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import Workshops from './Workshops';
import userEvent from '@testing-library/user-event';
import { API_BASE_URL } from '../../config/apiConfig';

describe('<Workshops />', () => {
  test('shows an empty result after loading', async () => {
    render(<Workshops pageName="Workshops" />);
    expect(await screen.findByText('Nessun workshop trovato.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  test('sorts years newest first and requests published events for the chosen year', async () => {
    const older = makeWorkshop({ workshopId: 'older', title: 'Older Workshop', eventDate: new Date('2023-03-15T10:00:00Z') });
    mockJson([older, makeWorkshop()]);
    render(<Workshops pageName="Workshops" />);
    const group = await screen.findByRole('group', { name: 'year filter' });
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['2024', '2023']);
    mockJson([older]);
    await userEvent.click(within(group).getByRole('button', { name: '2023' }));
    expect(await screen.findByRole('link', { name: 'Older Workshop' })).toHaveAttribute('href', '/workshop/older');
    expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/GetByYear/2023?onlyPublished=true`, expect.any(Object));
    expect(screen.queryByRole('link', { name: 'Test Workshop' })).not.toBeInTheDocument();
    mockJson([older, makeWorkshop()]);
    await userEvent.click(screen.getByRole('button', { name: 'Tutti gli anni' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Test Workshop' })).toBeInTheDocument());
    expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/Get?onlyPublished=true`, expect.any(Object));
  });

  test('shows an actionable error when the API fails', async () => {
    mockJson(null, 503);
    render(<Workshops pageName="Workshops" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load workshops. Please try again later.');
  });
});