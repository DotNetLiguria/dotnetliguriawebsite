import React, { ReactElement } from 'react';
import { render as testingRender, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkshopModel } from './models/WorkshopModel';
import { AccountCapabilities, AccountCapabilitiesProvider } from './account/AccountCapabilities';
export * from '@testing-library/react';

export function render(ui: ReactElement, options?: RenderOptions & { route?: string; accountProvider?: boolean }) {
  const { route = '/', accountProvider = false, ...renderOptions } = options ?? {};
  return testingRender(<MemoryRouter initialEntries={[route]}>{accountProvider
    ? <AccountCapabilitiesProvider>{ui}</AccountCapabilitiesProvider> : ui}</MemoryRouter>, renderOptions);
}

export const NO_CAPABILITIES: AccountCapabilities = {
  websiteAdmin: false, feedbackAdmin: false, backupAdmin: false, privacyAdmin: false, notificationAdmin: false,
};
export const ADMIN_CAPABILITIES: AccountCapabilities = {
  websiteAdmin: true, feedbackAdmin: true, backupAdmin: true, privacyAdmin: true, notificationAdmin: true,
};

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

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

type RouteAnswer = unknown | ((url: string, init?: RequestInit) => Response | Promise<Response>);

/**
 * Answers fetch calls by URL substring, in declaration order (put the most specific patterns first).
 * Unmatched requests get an empty JSON array, like the default stub in setupTests.
 */
export function mockApi(routes: Record<string, RouteAnswer>) {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, answer] of Object.entries(routes)) {
      if (!url.includes(pattern)) continue;
      return typeof answer === 'function'
        ? (answer as (url: string, init?: RequestInit) => Response | Promise<Response>)(url, init)
        : jsonResponse(answer);
    }
    return jsonResponse([]);
  });
}