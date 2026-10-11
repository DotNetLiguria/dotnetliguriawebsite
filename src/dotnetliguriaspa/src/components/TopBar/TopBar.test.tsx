import React from 'react';
import { render, screen, mockJson, within } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import TopBar from './TopBar';

describe('<TopBar />', () => {
  test('shows only active menu entries in their configured order', async () => {
    mockJson([
      { id: 'later', name: 'Later', url: '/later', isActive: true, order: 2 },
      { id: 'hidden', name: 'Hidden', url: '/hidden', isActive: false, order: 0 },
      { id: 'first', name: 'First', url: '/first', isActive: true, order: 1 },
    ]);
    render(<TopBar showMenu />);
    expect(await screen.findByRole('link', { name: 'First' })).toHaveAttribute('href', '/first');
    expect(within(screen.getByRole('list')).getAllByRole('link').map(link => link.textContent)).toEqual(['First', 'Later']);
    expect(screen.getByRole('link', { name: 'DotNetLiguria, area amministrazione' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('link', { name: 'Hidden' })).not.toBeInTheDocument();
  });

  test('retains fallback navigation when menu loading fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'));
    render(<TopBar showMenu />);
    expect(await screen.findByRole('link', { name: 'Eventi passati' })).toHaveAttribute('href', '/workshops');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});