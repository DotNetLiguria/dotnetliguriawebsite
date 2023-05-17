import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminWidgetLg from './AdminWidgetLg';

describe('<AdminWidgetLg />', () => {
  test('it should mount', () => {
    render(<AdminWidgetLg />);
    
    const adminWidgetLg = screen.getByTestId('AdminWidgetLg');

    expect(adminWidgetLg).toBeInTheDocument();
  });
});