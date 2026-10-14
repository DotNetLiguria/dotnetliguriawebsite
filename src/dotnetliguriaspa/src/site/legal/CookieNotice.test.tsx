import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import SiteLayout from '../SiteLayout';
import CookieNotice, { resetCookieNotice } from './CookieNotice';
import { COOKIE_NOTICE_KEY } from './legalFacts';

const notice = () => screen.queryByRole('region', { name: 'Informativa sui cookie' });

beforeEach(() => {
  resetCookieNotice();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<CookieNotice />', () => {
  test('informs without asking for consent or taking over the page', () => {
    render(<CookieNotice />);
    expect(notice()).toHaveTextContent('Questo sito usa solo cookie tecnici necessari al funzionamento: nessun tracciamento.');
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookie');
    expect(screen.getByRole('button', { name: 'Ho capito' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rifiuta|accetta/i })).not.toBeInTheDocument();
  });

  test('closes with the button and stays closed on the next visit', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const first = render(<CookieNotice />);
    await user.click(screen.getByRole('button', { name: 'Ho capito' }));
    expect(notice()).not.toBeInTheDocument();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).not.toBeNull();
    first.unmount();

    render(<CookieNotice />);
    expect(notice()).not.toBeInTheDocument();
  });

  test('stays reachable by keyboard and closes with Enter', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<CookieNotice />);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ho capito' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(notice()).not.toBeInTheDocument();
  });

  test('works when browser storage is unavailable and stays closed for the rest of the visit', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const denied = () => { throw new DOMException('Storage is blocked', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);

    const first = render(<CookieNotice />);
    expect(notice()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ho capito' }));
    expect(notice()).not.toBeInTheDocument();
    first.unmount();

    // Another page of the same visit mounts a new layout: the choice is not asked again.
    render(<CookieNotice />);
    expect(notice()).not.toBeInTheDocument();
  });

  test('makes room for itself while shown, so focused content scrolls clear of it', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    const root = document.documentElement;
    render(<CookieNotice />);
    expect(root.style.getPropertyValue('--site-notice-height')).toBe('120px');
    expect(root.style.scrollPaddingBottom).toBe('132px');

    await user.click(screen.getByRole('button', { name: 'Ho capito' }));
    expect(root.style.getPropertyValue('--site-notice-height')).toBe('');
    expect(root.style.scrollPaddingBottom).toBe('');
  });
});

describe('cookie notice on public pages', () => {
  test('is part of the public layout and hands focus to the page when closed', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    render(<SiteLayout><p>Contenuto della pagina</p></SiteLayout>);
    expect(notice()).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Contenuto della pagina');

    await user.click(screen.getByRole('button', { name: 'Ho capito' }));
    expect(notice()).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  test('comes after the skip link and the footer, so it never covers the first thing keyboard users reach', () => {
    render(<SiteLayout><p>Contenuto</p></SiteLayout>);
    const skip = screen.getByRole('link', { name: 'Salta al contenuto' });
    const region = notice()!;
    const footer = screen.getByRole('contentinfo');
    expect(skip.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
