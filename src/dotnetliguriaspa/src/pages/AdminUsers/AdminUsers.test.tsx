import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminUsers from './AdminUsers';

describe('<AdminUsers />', () => {
  test('it should mount', () => {
    render(<AdminUsers />);
    
    const adminUsers = screen.getByTestId('AdminUsers');

    expect(adminUsers).toBeInTheDocument();
  });
});