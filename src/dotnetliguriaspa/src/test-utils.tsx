import React, { ReactElement } from 'react';
import { render as testingRender, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkshopModel } from './models/WorkshopModel';
export * from '@testing-library/react';

export function render(ui: ReactElement, options?: RenderOptions & { route?: string }) {
  const { route = '/', ...renderOptions } = options ?? {};
  return testingRender(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>, renderOptions);
}

export function makeWorkshop(overrides: Partial<WorkshopModel> = {}): WorkshopModel {
  return {
    workshopId: 'workshop-1', title: 'Test Workshop', description: 'Workshop description',
    eventDate: new Date('2024-03-15T10:00:00Z'), creationDate: new Date('2024-01-01T00:00:00Z'),
    image: 'workshop.jpg', blogHtml: '', tags: '', published: true, in_homepage: false,
    isExternalEvent: false, externalRegistration: false, externalRegistrationLink: '', onlyHtml: false,
    location: { name: 'Genova', address: 'Via del Porto 1', coordinates: '44.4056,8.9463', maximumSpaces: 150 },
    tracks: [], oldUrl: '', slug: 'test-workshop', materials: [], photos: [], ...overrides,
  };
}

export function mockJson(data: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}