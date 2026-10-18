import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Dialog, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components';
import { useOidc, useOidcUser } from '@axa-fr/react-oidc';
import logo from '../assets/logo/dotnet-liguria-storico.png';
import logo2x from '../assets/logo/dotnet-liguria-storico-2x.png';
import { AdminIcon, AdminIconName } from './icons';
import { Avatar, btn, focusRing, linkFocus } from './ui';
import CommandPalette from './CommandPalette';
import { AdminToastRegion } from './toasts';
import { clearPrivateBrowserState } from '../questionnaire/drafts';

interface NavItem { label: string; to: string; icon: AdminIconName; match: string[]; end?: boolean }

export const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ label: 'Panoramica', to: '/admin', icon: 'home', match: ['/admin'], end: true }] },
  { group: 'Eventi', items: [
    { label: 'Eventi', to: '/admin/workshops/', icon: 'calendar', match: ['/admin/workshops', '/admin/workshop/', '/admin/events'] },
    { label: 'Relatori', to: '/admin/speakers/', icon: 'mic', match: ['/admin/speakers'] },
    { label: 'Sedi', to: '/admin/venues/', icon: 'pin', match: ['/admin/venues'] },
  ] },
  { group: 'Community', items: [
    { label: 'Board', to: '/admin/board/', icon: 'users', match: ['/admin/board'] },
    { label: 'Questionari', to: '/admin/questionnaires', icon: 'clipboard', match: ['/admin/questionnaires', '/admin/feedbacks'] },
  ] },
  { group: 'Sito', items: [
    { label: 'Menu del sito', to: '/admin/topmenu/', icon: 'list', match: ['/admin/topmenu'] },
    { label: 'Backup e import', to: '/admin/import-export/', icon: 'database', match: ['/admin/import-export', '/admin/downloads'] },
  ] },
];
const TABS = ['Panoramica', 'Eventi', 'Relatori'];

const isActive = (item: NavItem, path: string) =>
  item.end ? path.replace(/\/+$/, '') === item.to : item.match.some(prefix => path.startsWith(prefix));

function NavLinkItem({ item, path, onNavigate }: { item: NavItem; path: string; onNavigate?: () => void }) {
  const active = isActive(item, path);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors ${linkFocus} ${active ? 'bg-navy text-white' : 'text-navy/80 hover:bg-cyan-50 hover:text-navy'}`}
    >
      <AdminIcon name={item.icon} />{item.label}
    </Link>
  );
}

const Logo = ({ className }: { className: string }) => (
  <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} alt="" width={241} height={105} className={`${className} w-auto`} />
);

function useSignOut() {
  const { logout } = useOidc();
  const navigate = useNavigate();
  return async () => {
    clearPrivateBrowserState();
    await logout();
    navigate('/');
  };
}

function ProfileMenu() {
  const { oidcUser } = useOidcUser();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const name = oidcUser?.name ?? 'Area personale';
  return (
    <MenuTrigger>
      <Button className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition-colors data-[hovered]:bg-cyan-50 ${focusRing}`} aria-label={`Menu di ${name}`}>
        <Avatar name={name} className="size-9 text-sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-bold">{name}</span>
          {oidcUser?.email && <span className="block truncate text-sm text-muted">{oidcUser.email}</span>}
        </span>
        <AdminIcon name="chevron" className="size-4 text-muted" />
      </Button>
      <Popover placement="top start" offset={8} className="w-[var(--trigger-width)] min-w-56 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
        <Menu
          aria-label="Profilo"
          className="outline-none"
          onAction={key => {
            if (key === 'profile') navigate('/admin/profile/');
            if (key === 'site') window.open('/', '_blank', 'noopener');
            if (key === 'logout') void signOut();
          }}
        >
          <MenuItem id="profile" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50"><AdminIcon name="user" className="size-5 text-muted" />Profilo</MenuItem>
          <MenuItem id="site" textValue="Vedi il sito" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50"><AdminIcon name="external" className="size-5 text-muted" />Vedi il sito<span className="sr-only"> (si apre in una nuova scheda)</span></MenuItem>
          <MenuItem id="logout" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold text-[#b42318] outline-none data-[focused]:bg-[#fdecea]"><AdminIcon name="logout" />Esci</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function MoreSheet({ isOpen, onOpenChange, path }: { isOpen: boolean; onOpenChange: (open: boolean) => void; path: string }) {
  const signOut = useSignOut();
  const items = NAV.flatMap(g => g.items).filter(i => !TABS.includes(i.label));
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="fixed inset-0 z-50 flex items-end bg-[rgb(0_36_69/0.42)] lg:hidden">
      <Modal className="w-full rounded-t-3xl bg-white text-navy shadow-lift">
        <Dialog aria-label="Altre sezioni" className="outline-none">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-lg font-bold">Altre sezioni</p>
            <Button slot="close" aria-label="Chiudi" className={btn.icon}><AdminIcon name="x" /></Button>
          </div>
          <ul className="grid gap-0.5 px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {items.map(item => <li key={item.to}><NavLinkItem item={item} path={path} onNavigate={() => onOpenChange(false)} /></li>)}
            <li>
              <a href="/" target="_blank" rel="noopener noreferrer" className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-navy/80 hover:bg-cyan-50 ${linkFocus}`}>
                <AdminIcon name="external" />Vedi il sito<span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </li>
            <li>
              <Button onPress={() => void signOut()} className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 font-semibold text-[#b42318] data-[hovered]:bg-[#fdecea] ${focusRing}`}>
                <AdminIcon name="logout" />Esci
              </Button>
            </li>
          </ul>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function SignIn() {
  const { login } = useOidc();
  const location = useLocation();
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f3f7fa] px-4 text-navy">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 text-center">
        <Logo className="mx-auto h-16" />
        <h1 className="mt-6 text-2xl font-bold">Area riservata</h1>
        <p className="mt-2 text-muted">Accedi per gestire account, consensi e privacy. Le funzioni di amministrazione richiedono ruoli specifici.</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button onPress={() => login(location.pathname + location.search)} className={btn.primary}>Accedi</Button>
          <Link to="/" className={`inline-flex min-h-11 items-center font-semibold text-cyan-700 underline ${linkFocus}`}>Torna al sito</Link>
        </div>
      </div>
    </main>
  );
}

/** Back-office shell: side menu, top bar with ⌘K search, phone tab bar. Pages render in the Outlet. */
export default function AdminShell() {
  const { isAuthenticated } = useOidc();
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthenticated]);

  if (!isAuthenticated) return <SignIn />;

  const tabItems = NAV.flatMap(g => g.items).filter(i => TABS.includes(i.label));
  const moreActive = NAV.flatMap(g => g.items).some(i => !TABS.includes(i.label) && isActive(i, pathname));

  return (
    <div className="admin min-h-dvh bg-[#f3f7fa] text-navy antialiased selection:bg-cyan-200 selection:text-navy-950">
      <a href="#contenuto-admin" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-white">Salta al contenuto</a>
      <div className="lg:grid lg:h-dvh lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-white lg:flex lg:min-h-0 lg:flex-col" aria-label="Area amministrazione">
          <Link to="/admin" aria-label="DotNetLiguria, panoramica dell'amministrazione" className={`mx-5 mt-4 mb-2 inline-flex self-start rounded-lg ${linkFocus}`}><Logo className="h-12" /></Link>
          <nav aria-label="Sezioni" className="relative flex-1 overflow-y-auto px-3 pb-4">
            {NAV.map(group => (
              <div key={group.group ?? 'main'} className="mt-4">
                {group.group && <p className="px-3 pb-1 text-sm font-semibold text-muted">{group.group}</p>}
                <ul className="space-y-0.5">{group.items.map(item => <li key={item.to}><NavLinkItem item={item} path={pathname} /></li>)}</ul>
              </div>
            ))}
          </nav>
          <div className="border-t border-line p-3"><ProfileMenu /></div>
        </aside>

        <div className="flex min-h-dvh flex-col lg:min-h-0">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
            <Link to="/admin" aria-label="DotNetLiguria, panoramica dell'amministrazione" className={`inline-flex shrink-0 rounded-lg lg:hidden ${linkFocus}`}><Logo className="h-10" /></Link>
            <Button
              onPress={() => setPaletteOpen(true)}
              aria-keyshortcuts="Meta+K Control+K"
              className={`ml-auto flex h-11 min-w-0 max-w-md flex-1 cursor-pointer items-center gap-3 rounded-full border border-line bg-[#f3f7fa] px-4 text-left text-muted transition-colors data-[hovered]:border-cyan-200 lg:ml-0 ${focusRing}`}
            >
              <AdminIcon name="search" /><span className="flex-1 truncate">Cerca eventi, relatori, azioni…</span>
              <kbd className="hidden rounded-md border border-line bg-white px-1.5 text-sm font-semibold sm:inline">⌘K</kbd>
            </Button>
            <a href="/" target="_blank" rel="noopener noreferrer" className={`${btn.ghost} ml-auto hidden lg:inline-flex`}>
              <AdminIcon name="external" />Vedi il sito<span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
          </header>
          <main id="contenuto-admin" tabIndex={-1} className="relative flex-1 px-4 pt-6 pb-28 outline-none lg:overflow-y-auto lg:px-8 lg:pt-8 lg:pb-12">
            <div className="mx-auto max-w-[1200px]"><Outlet /></div>
          </main>
        </div>
      </div>

      <nav aria-label="Sezioni principali" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {tabItems.map(item => {
          const active = isActive(item, pathname);
          return (
            <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${linkFocus} ${active ? 'text-navy' : 'text-muted'}`}>
              <span className={`grid h-8 w-14 place-items-center rounded-full ${active ? 'bg-cyan-50' : ''}`}><AdminIcon name={item.icon} /></span>{item.label}
            </Link>
          );
        })}
        <Button onPress={() => setMoreOpen(true)} className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 text-sm font-semibold ${focusRing} ${moreActive ? 'text-navy' : 'text-muted'}`}>
          <span className={`grid h-8 w-14 place-items-center rounded-full ${moreActive ? 'bg-cyan-50' : ''}`}><AdminIcon name="more" /></span>Altro
        </Button>
      </nav>

      <MoreSheet isOpen={moreOpen} onOpenChange={setMoreOpen} path={pathname} />
      <CommandPalette isOpen={paletteOpen} onOpenChange={setPaletteOpen} />
      <AdminToastRegion />
    </div>
  );
}
