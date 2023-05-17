import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminWidgetSm from './AdminWidgetSm';

describe('<AdminWidgetSm />', () => {
  test('it should mount', () => {
    render(<AdminWidgetSm />);
    
    const adminWidgetSm = screen.getByTestId('AdminWidgetSm');

    expect(adminWidgetSm).toBeInTheDocument();
  });
});