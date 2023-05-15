import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminHome from './AdminHome';

describe('<AdminHome />', () => {
  test('it should mount', () => {
    render(<AdminHome />);
    
    const adminHome = screen.getByTestId('AdminHome');

    expect(adminHome).toBeInTheDocument();
  });
});