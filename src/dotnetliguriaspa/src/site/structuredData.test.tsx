import React from 'react';
import { render } from '../test-utils';
import JsonLd from './JsonLd';
import { SiteWorkshop } from './siteApi';
import { eventJsonLd, organizationJsonLd, postalAddress, romeOffset } from './structuredData';

const ORIGIN = 'https://dotnetliguria.net';
const workshop = (extra: Partial<SiteWorkshop> = {}): SiteWorkshop => ({
  workshopId: '89d23964-f3cd-4ca8-9e65-d15251e0b6a1',
  title: ' AI Generativa: analisi pragmatica ',
  description: 'Una giornata sulle novità della AI generativa.',
  eventDate: '2025-06-12T00:00:00+02:00',
  image: '/workshops/workshop040/workshop.png',
  location: { name: 'Confindustria', address: 'Via Minzoni 2,19100 La Spezia', coordinates: '44.1042253,9.8220812' },
  // Legacy tracks carry the right time of day on a wrong calendar day: only the time is used.
  tracks: [
    { workshopTrackId: 't2', title: 'Ricerca semantica', startTime: '2025-12-06T13:40:00Z', endTime: '2025-12-06T15:00:00Z', speakersName: 'Giampaolo Tucci' },
    { workshopTrackId: 't1', title: 'Saluto ai partecipanti', startTime: '2025-12-06T13:15:00Z', endTime: '2025-12-06T13:30:00Z', speakersName: 'Raffaele Rialdi' },
  ],
  ...extra,
});

describe('structured data', () => {
  test('describes the community as an Organization on the current origin', () => {
    expect(organizationJsonLd(ORIGIN)).toMatchObject({
      '@context': 'https://schema.org', '@type': 'Organization', name: 'DotNetLiguria', alternateName: 'DotNet Liguria',
      url: `${ORIGIN}/`, logo: `${ORIGIN}/logo512.png`, foundingDate: '2011',
    });
  });

  test('knows the Rome offset in winter and in summer', () => {
    expect(romeOffset('2025-01-15T12:00:00Z')).toBe('+01:00');
    expect(romeOffset('2025-07-15T12:00:00Z')).toBe('+02:00');
  });

  test('splits an Italian address into street, postal code and locality', () => {
    expect(postalAddress('Via Minzoni 2,19100 La Spezia')).toEqual({ '@type': 'PostalAddress', streetAddress: 'Via Minzoni 2', postalCode: '19100', addressLocality: 'La Spezia', addressCountry: 'IT' });
    expect(postalAddress('Via del Porto 1')).toEqual({ '@type': 'PostalAddress', streetAddress: 'Via del Porto 1', addressCountry: 'IT' });
    expect(postalAddress('16121 Genova')).toEqual({ '@type': 'PostalAddress', postalCode: '16121', addressLocality: 'Genova', addressCountry: 'IT' });
  });

  test('describes a past event with its day, programme times in Rome, venue, speakers and poster', () => {
    const data = eventJsonLd(workshop(), ORIGIN, `${ORIGIN}/workshop/89d23964-f3cd-4ca8-9e65-d15251e0b6a1`);
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'AI Generativa: analisi pragmatica',
      description: 'Una giornata sulle novità della AI generativa.',
      startDate: '2025-06-12T14:15:00+02:00',
      endDate: '2025-06-12T16:00:00+02:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: `${ORIGIN}/workshop/89d23964-f3cd-4ca8-9e65-d15251e0b6a1`,
      image: expect.stringMatching(/\/Contents\/workshops\/workshop040\/workshop\.png$/),
      location: {
        '@type': 'Place',
        name: 'Confindustria',
        address: { '@type': 'PostalAddress', streetAddress: 'Via Minzoni 2', postalCode: '19100', addressLocality: 'La Spezia', addressCountry: 'IT' },
        geo: { '@type': 'GeoCoordinates', latitude: 44.1042253, longitude: 9.8220812 },
      },
      organizer: { '@type': 'Organization', name: 'DotNetLiguria', url: `${ORIGIN}/` },
      performer: [{ '@type': 'Person', name: 'Raffaele Rialdi' }, { '@type': 'Person', name: 'Giampaolo Tucci' }],
    });
    expect(data.image).toMatch(/^https?:\/\//);
    expect('offers' in data).toBe(false);
  });

  test('adds the registration offer to upcoming events and falls back to the day alone without a programme', () => {
    const upcoming = eventJsonLd(
      workshop({ eventDate: '2099-01-20T00:00:00+01:00', tracks: [], externalRegistration: true, externalRegistrationLink: 'https://iscrizioni.example.test/ev', image: null, location: { name: 'Genova' } }),
      ORIGIN, `${ORIGIN}/workshop/x`,
    );
    expect(upcoming).toMatchObject({ startDate: '2099-01-20', offers: { '@type': 'Offer', url: 'https://iscrizioni.example.test/ev' }, location: { '@type': 'Place', name: 'Genova' } });
    expect(upcoming).not.toHaveProperty('endDate');
    expect(upcoming).not.toHaveProperty('image');
    expect(upcoming).not.toHaveProperty('performer');
    expect(upcoming.location).not.toHaveProperty('address');
    expect(upcoming.location).not.toHaveProperty('geo');
  });

  test('<JsonLd /> cannot be broken out of by the content', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }} />);
    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.textContent).not.toContain('</script>');
    expect(JSON.parse(script.textContent!)).toEqual({ '@type': 'Thing', name: '</script><script>alert(1)</script>' });
  });
});
