import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useOidc } from '@axa-fr/react-oidc';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '../../test-utils';
import { CapabilityContext } from '../../account/AccountCapabilities';
import type { Permission } from '../../account/permissions';
import AdminShell from '../AdminShell';

function mount(route: string, permissions: Permission[] = ['newsletters.read']) {
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() } as unknown as ReturnType<typeof useOidc>);
  return render(<CapabilityContext.Provider value={{ status: 'ready', capabilities: { schemaVersion: 1, permissions, canAccessAdmin: true }, refresh: vi.fn(), retry: vi.fn(), clear: vi.fn() }}>
    <Routes><Route element={<AdminShell />}><Route path="/admin/*" element={<h1>Sezione newsletter di prova</h1>} /></Route></Routes>
  </CapabilityContext.Provider>, { route });
}

test.each([
  ['/admin/newsletters/n1', 'Newsletter', 'Template newsletter'],
  ['/admin/newsletter-templates/t1', 'Template newsletter', 'Newsletter'],
])('newsletter navigation keeps distinct prefixes on %s', (route, active, inactive) => {
  mount(route);
  const nav = screen.getByRole('navigation', { name: 'Sezioni' });
  expect(within(nav).getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: inactive })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('heading', { name: 'Sezione newsletter di prova' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['/admin/newsletters/n1', '/admin/newsletter-templates/t1'])('manage/send without read cannot enter %s', route => {
  mount(route, ['newsletters.manage', 'newsletters.send']);
  expect(screen.getByRole('heading', { name: 'Accesso non autorizzato' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sezione newsletter di prova' })).not.toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Sezioni' });
  expect(within(nav).queryByRole('link', { name: 'Newsletter' })).not.toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Template newsletter' })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('newsletter reader can discover both sections in the palette without fetching unrelated event/speaker data', async () => {
  mount('/admin/newsletters');
  const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
  await user.keyboard('{Control>}k{/Control}');
  const dialog = await screen.findByRole('dialog', { name: 'Cerca e vai' });
  expect(within(dialog).getByRole('menuitem', { name: /Newsletter\s*Bozze e invii/ })).toBeInTheDocument();
  expect(within(dialog).getByRole('menuitem', { name: /Template newsletter\s*Modelli Markdown/ })).toBeInTheDocument();
  expect(within(dialog).queryByRole('menuitem', { name: /Nuovo evento/ })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
