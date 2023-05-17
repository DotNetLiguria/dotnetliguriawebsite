import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import Layout from './Layout';

describe('<Layout />', () => {
  test('it should mount', () => {
    render(<Layout />);
    
    const layout = screen.getByTestId('Layout');

    expect(layout).toBeInTheDocument();
  });
});