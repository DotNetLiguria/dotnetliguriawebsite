import React from 'react';
import { render, screen } from '../../test-utils';
import '@testing-library/jest-dom/vitest';
import WorkshopItem from './WorkshopItem';

describe('<WorkshopItem />', () => {
    test('shows the title, location and detail link for a workshop without tracks', () => {
        render(<WorkshopItem workshop={{
            workshopId: '1',
            title: 'Test Workshop',
            description: 'This is a test workshop description',
            eventDate: new Date('2024-03-15'),
            image: 'https://example.com/workshop.jpg',
            creationDate: new Date(),
            blogHtml: '',
            tags: '',
            published: true,
            in_homepage: false,
            isExternalEvent: false,
            externalRegistration: false,
            externalRegistrationLink: '',
            onlyHtml: false,
            location: {
                name: 'Centro Congressi',
                address: 'Via del Porto 1, 16121 Genova GE',
                coordinates: '44.4056,8.9463',
                maximumSpaces: 150
            },
            tracks: [],
            oldUrl: '',
            slug: 'test-workshop',
            materials: [],
            photos: []
        }} />);

        expect(screen.getByText(/Centro Congressi.*Via del Porto 1/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Test Workshop' })).toHaveAttribute('href', '/workshop/1');
        expect(screen.getByText('Tracks')).toBeInTheDocument();
    });
});
