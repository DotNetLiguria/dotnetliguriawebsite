import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '../../test-utils';
import ProfilePage from './ProfilePage';

describe('<ProfilePage />', () => {
  test('keeps every profile field, says saving is not wired yet and links the Keycloak account', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<ProfilePage />, { route: '/admin/profile/' });

    expect(screen.getByRole('heading', { level: 1, name: 'Profilo' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Salvataggio da completare');
    expect(screen.getByRole('link', { name: /Apri il tuo account/ })).toHaveAttribute('href', 'https://hello.vevy.com/realms/DotNetLiguria/account');

    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Test');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('user@example.test');
    const work = screen.getByRole('region', { name: 'Azienda' });
    expect(within(work).getAllByRole('textbox').map(i => i.getAttribute('aria-labelledby') && i.closest('.block')?.querySelector('label')?.textContent))
      .toEqual(['Azienda', 'Ruolo', 'Città', 'Provincia']);
    for (const name of ['X / Twitter', 'LinkedIn', 'GitHub']) expect(screen.getByRole('textbox', { name })).toHaveValue('');
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /informativa sulla privacy/ })).toHaveAttribute('href', '/privacy');

    await user.type(screen.getByRole('textbox', { name: 'LinkedIn' }), 'linkedin.com/in/test');
    await user.tab();
    expect(await screen.findByText('Inserisci un indirizzo completo che inizi con https://')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva (da completare)' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
