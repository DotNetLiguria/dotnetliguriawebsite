import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminWorkshops from './AdminWorkshops';

describe('<AdminWorkshops />', () => {
  test('it should mount', () => {
    render(<AdminWorkshops />);
    
    const adminWorkshops = screen.getByTestId('AdminWorkshops');

    expect(adminWorkshops).toBeInTheDocument();
  });
});