import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminTokens from './AdminTokens';

describe('<AdminTokens />', () => {
  test('it should mount', () => {
    render(<AdminTokens />);
    
    const adminTokens = screen.getByTestId('AdminTokens');

    expect(adminTokens).toBeInTheDocument();
  });
});