import React from 'react';
import { mockApi, render, screen, within } from '../../test-utils';
import AccessPage from './AccessPage';

test('photo and speaker onboarding audit operations have Italian labels and invitation acceptance is not delivery', async () => {
  const actions = [
    ['account-photo-select', 'Scelta foto account'], ['account-photo-upload', 'Caricamento foto account'],
    ['board-photo-select', 'Scelta foto Board'], ['board-photo-upload', 'Caricamento foto Board'],
    ['speaker-photo-select', 'Scelta foto speaker'], ['speaker-photo-upload', 'Caricamento foto speaker'],
    ['speaker-link', 'Collegamento account speaker'], ['speaker-create', 'Creazione account speaker'],
    ['speaker-invite', 'Invio invito speaker'],
  ];
  mockApi({
    '/admin/access/permissions': { permissions: [] },
    '/admin/access/users?': { users: [], hasMore: false },
    '/admin/access/audit?': { entries: actions.map(([action], index) => ({
      at: '2026-10-20T12:00:00Z', action, permission: '', actorSubject: 'actor', targetSubject: 'target',
      outcome: action === 'speaker-invite' ? 'accepted' : 'verified', correlationId: `audit-${index}`,
    })) },
  });
  render(<AccessPage />);
  const table = await screen.findByRole('table', { name: 'Cronologia modifiche ai permessi' });
  for (const [, label] of actions) expect(within(table).getByText(label)).toBeInTheDocument();
  expect(within(table).getByText('Accettata dall’Identity Provider (consegna non verificata)')).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
});
