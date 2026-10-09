import React from 'react';
import { render, screen, makeWorkshop, mockJson, waitFor } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import AdminWorkshops from './AdminWorkshops';
import userEvent from '@testing-library/user-event';
import { API_BASE_URL } from '../../config/apiConfig';

describe('<AdminWorkshops />', () => {
  test('loads unpublished events too and filters grid rows by title', async () => {
    mockJson([makeWorkshop(), makeWorkshop({ workshopId: 'other', title: 'Other Event', published: false })]);
    render(<AdminWorkshops pageName="Workshops" />);
    expect(await screen.findByText('Other Event')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/Workshop/Get?onlyPublished=false`);
    await userEvent.type(screen.getByPlaceholderText('Cerca per titolo workshop...'), 'other');
    await waitFor(() => expect(screen.queryByText('Test Workshop')).not.toBeInTheDocument());
    expect(screen.getByText('Other Event')).toBeInTheDocument();
    expect(screen.getByText(/1.1 of 1/)).toBeInTheDocument();
  });
});