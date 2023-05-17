import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import PageNotFound from './PageNotFound';

describe('<PageNotFound />', () => {
  test('it should mount', () => {
    render(<PageNotFound pagename={""}/>);

    const pageNotFound = screen.getByTestId('PageNotFound');

    expect(pageNotFound).toBeInTheDocument();
  });
});