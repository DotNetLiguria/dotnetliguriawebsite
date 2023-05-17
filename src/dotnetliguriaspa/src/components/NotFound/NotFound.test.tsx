import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import NotFound from './NotFound';

describe('<NotFound />', () => {
  test('it should mount', () => {
    render(<NotFound pagename={""}/>);

    const notFound = screen.getByTestId('NotFound');

    expect(notFound).toBeInTheDocument();
  });
});