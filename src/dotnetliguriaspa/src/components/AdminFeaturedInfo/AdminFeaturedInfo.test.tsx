import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminFeaturedInfo from './AdminFeaturedInfo';

describe('<AdminFeaturedInfo />', () => {
  test('it should mount', () => {
    render(<AdminFeaturedInfo />);
    
    const adminFeaturedInfo = screen.getByTestId('AdminFeaturedInfo');

    expect(adminFeaturedInfo).toBeInTheDocument();
  });
});