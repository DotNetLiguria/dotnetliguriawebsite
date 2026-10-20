import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, mockApi, jsonResponse, waitFor } from '../../test-utils';
import { CapabilityContext } from '../../account/AccountCapabilities';
import { useMfaWindow } from '../../account/useMfaWindow';
import BoardAccountPanel from './BoardAccountPanel';

vi.mock('../../account/useMfaWindow', () => ({ useMfaWindow: vi.fn() }));

const account = { subject: 'account-id', username: 'board-user', enabled: true };
const initial = () => ({ boardId: 'b1', email: 'board@example.test', account: null as typeof account | null, isMember: false, candidates: [account] });
function serve(options: { member?: boolean; failWrite?: boolean; noCandidates?: boolean } = {}) {
  const status = initial();
  if (options.member) { status.account = account; status.isMember = true; status.candidates = []; }
  if (options.noCandidates) status.candidates = [];
  const writes: { path: string; body: Record<string, unknown>; headers: RequestInit['headers'] }[] = [];
  mockApi({
    '/admin/access/users?': { users: [account], hasMore: false },
    '/admin/board-accounts/b1': (path: string, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') return jsonResponse(status);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      writes.push({ path, body, headers: init.headers });
      if (options.failWrite) return jsonResponse({ code: 'board_membership_unverified' }, 503);
      if (path.endsWith('/link')) { status.account = account; status.candidates = []; }
      else status.isMember = body.join === true;
      return new Response(null, { status: 204 });
    },
  });
  return { status, writes };
}

beforeEach(() => vi.mocked(useMfaWindow).mockReturnValue({ active: true, strong: true, remaining: 250, level: 'mfa' }));

test('discovering an account never links or grants until two separate confirmations', async () => {
  const { writes } = serve();
  const user = userEvent.setup({ delay: null });
  render(<BoardAccountPanel boardId="b1" email="board@example.test" />);
  await screen.findByRole('button', { name: 'Collega board-user' });
  expect(writes).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Collega board-user' }));
  expect(writes).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  await screen.findByText('board-user: collegato, non nel gruppo Board');
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toMatch(/\/link$/);
  expect(writes[0].body).toEqual({ subject: 'account-id', expectedEmail: 'board@example.test', matchEmail: true });
  expect(writes[0].headers).toEqual(expect.objectContaining({ 'X-Confirm-Board-Change': 'link' }));
  await user.click(screen.getByRole('button', { name: 'Aggiungi al gruppo Board' }));
  expect(writes).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  await screen.findByText('board-user: membro del gruppo Board');
  expect(writes[1].body).toEqual({ subject: 'account-id', expectedMember: false, join: true });
});

test('legacy profiles can select an existing directory account after saving', async () => {
  const { writes } = serve({ noCandidates: true });
  render(<BoardAccountPanel boardId="b1" />);
  const user = userEvent.setup({ delay: null });
  await screen.findByText('Profilo non collegato a un account');
  await user.type(screen.getByRole('textbox', { name: 'Cerca account nell’Identity Provider' }), 'board');
  await user.click(screen.getByRole('button', { name: 'Cerca account' }));
  await user.click(await screen.findByRole('button', { name: 'Seleziona board-user' }));
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body.matchEmail).toBe(false);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('boardOnly=false&search=board'))).toBe(true);
});

test('removing membership leaves account linked and explains independent grants', async () => {
  const { writes } = serve({ member: true });
  render(<BoardAccountPanel boardId="b1" />);
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Rimuovi dal gruppo Board' }));
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  await screen.findByText('board-user: collegato, non nel gruppo Board');
  expect(writes[0].body).toEqual({ subject: 'account-id', expectedMember: true, join: false });
  expect(screen.getByText(/Permessi diretti o derivanti da altri gruppi/)).toBeInTheDocument();
  expect(writes.every(write => !write.path.includes('/Board/'))).toBe(true);
});

test('uncertain mutations hide stale status and require explicit reload', async () => {
  const { writes } = serve({ member: true, failWrite: true });
  render(<BoardAccountPanel boardId="b1" />);
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole('button', { name: 'Rimuovi dal gruppo Board' }));
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/ricarica lo stato/i);
  expect(screen.queryByRole('button', { name: 'Rimuovi dal gruppo Board' })).not.toBeInTheDocument();
  expect(writes).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Ricarica stato account' }));
  await screen.findByRole('button', { name: 'Rimuovi dal gruppo Board' });
  expect(writes).toHaveLength(1);
});

test('expired MFA disables membership changes', async () => {
  vi.mocked(useMfaWindow).mockReturnValue({ active: false, strong: true, remaining: 0, level: 'mfa' });
  serve({ member: true });
  render(<BoardAccountPanel boardId="b1" />);
  expect(await screen.findByRole('button', { name: 'Rimuovi dal gruppo Board' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Verifica MFA' })).toBeEnabled();
});

test('content-only editors never request private account or directory data', async () => {
  serve();
  render(<CapabilityContext.Provider value={{ status: 'ready',
    capabilities: { schemaVersion: 1, permissions: ['board.read', 'board.manage'], canAccessAdmin: true },
    retry: vi.fn(), clear: vi.fn(), refresh: vi.fn(),
  }}><BoardAccountPanel boardId="b1" /></CapabilityContext.Provider>);
  expect(screen.getByText(/serve l’autorizzazione alla lettura degli utenti/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('link-only Board editors can associate an existing account with MFA but cannot grant group membership', async () => {
  const { writes } = serve();
  render(<CapabilityContext.Provider value={{ status: 'ready',
    capabilities: { schemaVersion: 1, permissions: ['board.read', 'board.manage', 'access.users.read'], canAccessAdmin: true },
    retry: vi.fn(), clear: vi.fn(), refresh: vi.fn(),
  }}><BoardAccountPanel boardId="b1" /></CapabilityContext.Provider>);
  const user = userEvent.setup({ delay: null });
  expect(await screen.findByRole('button', { name: 'Collega board-user' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Collega board-user' }));
  await user.click(screen.getByRole('button', { name: 'Conferma modifica account' }));
  expect(await screen.findByRole('button', { name: 'Aggiungi al gruppo Board' })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toMatch(/\/link$/);
});
