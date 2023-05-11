import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import SideBar from './SideBar';

describe('<SideBar />', () => {
  test('it should mount', () => {
    render(<SideBar />);
    
    const sideBar = screen.getByTestId('SideBar');

    expect(sideBar).toBeInTheDocument();
  });
});