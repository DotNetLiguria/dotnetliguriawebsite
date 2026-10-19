import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Disclosure, DisclosurePanel, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { useOidc, useOidcUser } from '@axa-fr/react-oidc';
// Historic logo of dotnetliguria.net, in use until the new vector identity ships (see src/assets/logo).
import logo from '../assets/logo/dotnet-liguria-storico.png';
import logo2x from '../assets/logo/dotnet-liguria-storico-2x.png';
import { getTopMenu, isAbortError } from './siteApi';
import { Icon } from './icons';
import { clearPrivateBrowserState } from '../questionnaire/drafts';
import { useAccountCapabilities } from '../account/AccountCapabilities';
import { accountReturnPath } from '../account/returnPath';

interface MenuItem {
  label: string;
  href: string;
}

// Used when the TopMenu API cannot be reached, so the site stays navigable.
export const FALLBACK_MENU: MenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Prossimo evento', href: '/#evidence' },
  { label: 'Il Team', href: '/#team' },
  { label: 'Eventi passati', href: '/workshops' },
];

const isHomeAnchor = (href: string) => href === '/' || href.startsWith('/#');

function scrollToHash(hash: string) {
  const target = hash ? document.getElementById(hash) : null;
  if (target) target.scrollIntoView({ block: 'start' });
  else window.scrollTo({ top: 0 });
}

const focusRing = 'outline-none';

function AccountControl({ onNavigate }: { onNavigate?: () => void }) {
  const { login, logout, isAuthenticated } = useOidc();
  const { oidcUser } = useOidcUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { capabilities } = useAccountCapabilities();
  const [logoutError, setLogoutError] = useState('');
  const pill = `inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-navy px-5 font-bold text-navy transition data-[hovered]:bg-navy data-[hovered]:text-white ${focusRing}`;

  if (!isAuthenticated) {
    return <Button className={pill} onPress={() => login(accountReturnPath(location))}>Area Personale</Button>;
  }
  return (
    <><MenuTrigger>
      <Button className={pill}>
        {oidcUser?.name ? `Ciao, ${oidcUser.name}` : 'Area personale'}
      </Button>
      <Popover placement="bottom end" className="z-50 min-w-60 rounded-xl border border-line bg-white p-2 text-navy shadow-lift">
        <Menu aria-label="Account" className="outline-none" onAction={key => {
          onNavigate?.();
          if (key === 'personal') navigate('/area-personale');
          if (key === 'dashboard') navigate('/admin');
          if (key === 'logout') {
            clearPrivateBrowserState();
            void logout('/').then(() => navigate('/')).catch(() => setLogoutError('Uscita non riuscita. Riprova o chiudi la scheda.'));
          }
        }}>
          <MenuItem id="personal" className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50">Area personale</MenuItem>
          {capabilities?.canAccessAdmin && <MenuItem id="dashboard" className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50">Dashboard</MenuItem>}
          <MenuItem id="logout" className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50">Esci</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
    {logoutError && <p role="alert" className="p-3 text-sm text-red-900">{logoutError}</p>}</>
  );
}

export default function SiteHeader() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    getTopMenu(controller.signal)
      .then(menu => setItems(menu
        .filter(item => item.isActive)
        .sort((a, b) => a.order - b.order)
        .map(item => ({ label: item.name, href: item.url }))))
      .catch(error => {
        if (!isAbortError(error)) setItems(FALLBACK_MENU);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !(event.target instanceof Element && event.target.closest('[role="menu"]'))) {
        setExpanded(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const follow = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setExpanded(false);
    if (!isHomeAnchor(href)) return;
    event.preventDefault();
    const hash = href.startsWith('/#') ? href.slice(2) : '';
    if (location.pathname === '/') scrollToHash(hash);
    else {
      navigate('/');
      window.setTimeout(() => scrollToHash(hash), 100);
    }
  };

  const current = (href: string) => !isHomeAnchor(href) && location.pathname.startsWith(href);
  const menuLink = (item: MenuItem, mobile: boolean) => {
    const className = mobile
      ? 'flex min-h-12 items-center justify-between rounded-2xl px-4 text-lg font-semibold text-navy no-underline hover:bg-cyan-50'
      : `inline-flex min-h-11 items-center rounded-full px-4 font-semibold no-underline transition hover:bg-cyan-50 ${current(item.href) ? 'bg-cyan-50 text-cyan-700' : 'text-navy'}`;
    const content = mobile ? <>{item.label}<Icon name="arrow" className="size-5 text-cyan-700" /></> : item.label;
    return isHomeAnchor(item.href)
      ? <a href={item.href} className={className} onClick={event => follow(event, item.href)}>{content}</a>
      : <Link to={item.href} className={className} aria-current={current(item.href) ? 'page' : undefined} onClick={() => setExpanded(false)}>{content}</Link>;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <Disclosure isExpanded={expanded} onExpandedChange={setExpanded}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center rounded-lg" aria-label="DotNetLiguria, pagina iniziale" onClick={() => setExpanded(false)}>
            <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} alt="" width={241} height={105} className="h-14 w-auto sm:h-16" />
          </Link>
          <nav aria-label="Principale" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {items.map(item => <li key={item.href}>{menuLink(item, false)}</li>)}
              <li className="ml-2"><AccountControl /></li>
            </ul>
          </nav>
          <Button
            ref={trigger}
            slot="trigger"
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-navy px-4 font-bold text-navy lg:hidden ${focusRing}`}
          >
            <Icon name={expanded ? 'close' : 'menu'} />
            Menu
          </Button>
        </div>
        <DisclosurePanel className="border-t border-line bg-white lg:hidden">
          <nav aria-label="Principale">
            <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-2 py-3">
              {items.map(item => <li key={item.href}>{menuLink(item, true)}</li>)}
              <li className="px-2 pt-2"><AccountControl onNavigate={() => setExpanded(false)} /></li>
            </ul>
          </nav>
        </DisclosurePanel>
      </Disclosure>
    </header>
  );
}
