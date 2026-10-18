import React from 'react';
import { useOidc } from '@axa-fr/react-oidc';
import { render, screen, within } from '../../test-utils';
import App from '../../App';
import { userProfileLocalStorageStore } from '../../store/userProfileLocalStorageStore';
import { resetCookieNotice } from './CookieNotice';
import CookiePolicyPage from './CookiePolicyPage';
import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';
import { COOKIE_NOTICE_KEY } from './legalFacts';

const pages = [
  { name: 'privacy', Page: PrivacyPage, route: '/privacy', title: 'Informativa sulla privacy' },
  { name: 'terms', Page: TermsPage, route: '/termini-di-servizio', title: 'Termini di servizio' },
  { name: 'cookie policy', Page: CookiePolicyPage, route: '/cookie', title: 'Cookie policy' },
];

beforeEach(() => {
  resetCookieNotice();
});

describe.each(pages)('$name page', ({ Page, route, title }) => {
  test('has its main heading, title, description and update date', () => {
    render(<Page />, { route });
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(document.title).toBe(`${title} · DotNetLiguria`);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy();
    const updated = screen.getByText(/Ultimo aggiornamento/);
    expect(within(updated).getByText('11 ottobre 2026')).toHaveAttribute('datetime', '2026-10-11');
  });

  test('marks what the association still has to supply instead of inventing it', () => {
    render(<Page />, { route });
    expect(screen.getAllByText('Da completare').length).toBeGreaterThan(0);
    expect(screen.getByText(/denominazione completa, forma giuridica, codice fiscale e sede legale/)).toBeInTheDocument();
    expect(screen.getByText(/indirizzo email a cui scrivere/)).toBeInTheDocument();
  });

  test('keeps headings in order and sections labelled', () => {
    render(<Page />, { route });
    const levels = screen.getAllByRole('heading').map(heading => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    expect(levels.filter(level => level === 1)).toHaveLength(1);
    levels.slice(1).forEach((level, index) => expect(level).toBeLessThanOrEqual(levels[index] + 1));
  });

  test('links the three legal pages and marks the current one', () => {
    render(<Page />, { route });
    const nav = screen.getByRole('navigation', { name: 'Informative' });
    expect(within(nav).getByRole('link', { name: 'Informativa sulla privacy' })).toHaveAttribute('href', '/privacy');
    expect(within(nav).getByRole('link', { name: 'Termini di servizio' })).toHaveAttribute('href', '/termini-di-servizio');
    expect(within(nav).getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookie');
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', route);
  });
});

describe('privacy page', () => {
  test('names the processor, the rights and the supervisory authority', () => {
    render(<PrivacyPage />, { route: '/privacy' });
    expect(screen.getByText(/Vevy Europe S\.p\.A\. \(via Semeria, 16A - 16131 Genova - Italia - P\.IVA IT00269300109\) ospita il sito/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'I tuoi diritti' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /www\.garanteprivacy\.it/ })).toHaveAttribute('href', 'https://www.garanteprivacy.it');
    expect(screen.getByText(/Non facciamo profilazione/)).toBeInTheDocument();
    expect(screen.getByText(/verificare e documentare localizzazione dei servizi/)).toBeInTheDocument();
  });

  test('covers the questionnaire data, with consent as its basis', () => {
    render(<PrivacyPage />, { route: '/privacy' });
    expect(screen.getByRole('heading', { level: 3, name: 'Questionari di feedback' })).toBeInTheDocument();
    expect(screen.getByText(/riferimento immutabile all'account/)).toBeInTheDocument();
    expect(screen.getByText(/massimo 30 minuti/)).toBeInTheDocument();
    expect(screen.getByText(/non è configurato un servizio di invio/)).toBeInTheDocument();
    expect(screen.getByText(/Base giuridica: il tuo consenso/)).toBeInTheDocument();
  });

  test('asks for the retention periods it cannot know', () => {
    render(<PrivacyPage />, { route: '/privacy' });
    const retention = screen.getByRole('region', { name: 'Per quanto tempo conserviamo i dati' });
    expect(within(retention).getAllByText('Da completare')).toHaveLength(4);
  });
});

describe('terms page', () => {
  test('says whom the content belongs to and where the code lives', () => {
    render(<TermsPage />, { route: '/termini-di-servizio' });
    expect(screen.getByText(/I contenuti dei talk .* appartengono ai rispettivi autori/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/DotNetLiguria/dotnetliguriawebsite');
    expect(screen.getByText(/regolati dalla legge italiana/)).toBeInTheDocument();
    expect(screen.getByText(/Il sito è ospitato da Vevy Europe S\.p\.A\./)).toBeInTheDocument();
  });
});

describe('cookie policy page', () => {
  test('lists every item the site can store, with purpose and duration', () => {
    render(<CookiePolicyPage />, { route: '/cookie' });
    for (const name of [COOKIE_NOTICE_KEY, 'questionnaire-draft:…', 'Cookie di sessione di Keycloak', 'OidcServiceWorker.js', 'oidc.…']) {
      const item = screen.getByRole('heading', { level: 4, name }).closest('li')!;
      expect(within(item).getByText('Durata:')).toBeInTheDocument();
      expect(within(item).getByText('A cosa serve:')).toBeInTheDocument();
    }
  });

  test('states that nothing tracks visitors and why no consent banner is required', () => {
    render(<CookiePolicyPage />, { route: '/cookie' });
    expect(screen.getByText(/non usiamo strumenti di analisi o statistica/)).toBeInTheDocument();
    expect(screen.getByText(/né cookie di terze parti/)).toBeInTheDocument();
    expect(screen.getByText(/Linee guida cookie e altri strumenti di tracciamento del Garante/)).toBeInTheDocument();
    expect(screen.getByText(/Vevy Europe S\.p\.A\. \(hello\.vevy\.com\), non questo sito/)).toBeInTheDocument();
  });
});

describe('routing', () => {
  test.each(pages)('$route renders the $name page inside the public layout', async ({ route, title }) => {
    render(<App />, { route });
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Salta al contenuto' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Informativa sui cookie' })).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  test('the admin area does not show the public cookie notice', async () => {
    userProfileLocalStorageStore.getState().setProfileSaved(true);
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    render(<App />, { route: '/admin' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Ciao, Test' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Informativa sui cookie' })).not.toBeInTheDocument();
  });
});
