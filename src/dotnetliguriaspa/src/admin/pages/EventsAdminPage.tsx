import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Label, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Popover, SearchField, Select, SelectValue, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { Badge, EmptyState, LoadError, PageHeader, Panel, btn, focusRing, linkFocus } from '../ui';
import { AdminWorkshop, clean, nameKey, speakerNamesOf, useAdminLoad } from '../adminApi';
import { contentUrl } from '../../site/siteApi';
import { dayKey, formatDate, formatWeekday } from '../../site/format';
import { programme, sessionCount } from '../../site/event/programme';

type SortKey = 'date' | 'title' | 'sessions';
type Sort = { key: SortKey; direction: 'ascending' | 'descending' };

const pill = `inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-4 font-semibold text-navy transition-colors data-[hovered]:border-cyan-200 data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white ${focusRing}`;
const yearOf = (iso: string) => dayKey(iso).slice(0, 4);
const PAGE = 25;
// Few years fit as pills; a long archive (events since 2011) gets a compact select instead.
const MAX_YEAR_PILLS = 5;

interface Row {
  w: AdminWorkshop;
  title: string;
  place: string;
  sessions: number;
  materials: number;
  upcoming: boolean;
  search: string;
}

function StatusBadges({ row }: { row: Row }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {row.upcoming && <Badge kind="planned">In programma</Badge>}
      {row.w.in_homepage && <Badge kind="ok">In evidenza</Badge>}
      {row.w.published === false && <Badge kind="warn">Bozza</Badge>}
    </span>
  );
}

function RowActions({ row }: { row: Row }) {
  const navigate = useNavigate();
  return (
    <span className="flex justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      <a href={`/workshop/${row.w.workshopId}`} target="_blank" rel="noopener noreferrer" className={btn.icon} aria-label={`Vedi sul sito: ${row.title} (si apre in una nuova scheda)`}>
        <AdminIcon name="external" />
      </a>
      <MenuTrigger>
        <Button className={btn.icon} aria-label={`Altre azioni per ${row.title}`}><AdminIcon name="more" /></Button>
        <Popover placement="bottom end" className="min-w-52 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
          <Menu aria-label={`Azioni per ${row.title}`} className="outline-none" onAction={key => {
            if (key === 'edit') navigate(`/admin/workshop/${row.w.workshopId}`);
            if (key === 'site') window.open(`/workshop/${row.w.workshopId}`, '_blank', 'noopener');
          }}>
            <MenuItem id="edit" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50"><AdminIcon name="pencil" className="size-5 text-muted" />Modifica</MenuItem>
            <MenuItem id="site" textValue="Vedi sul sito" className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50"><AdminIcon name="external" className="size-5 text-muted" />Vedi sul sito<span className="sr-only"> (si apre in una nuova scheda)</span></MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </span>
  );
}

function SortHeader({ label, column, sort, onSort, className = '' }: { label: string; column: SortKey; sort: Sort; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort.key === column;
  return (
    <th scope="col" aria-sort={active ? sort.direction : 'none'} className={`py-2 font-semibold ${className}`}>
      <Button onPress={() => onSort(column)} className={`inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-1 text-muted data-[hovered]:text-navy ${focusRing}`}>
        {label}
        <AdminIcon name="chevron" className={`size-4 transition-transform ${active ? 'text-navy' : 'opacity-40'} ${active && sort.direction === 'ascending' ? 'rotate-180' : ''}`} />
      </Button>
    </th>
  );
}

export default function EventsAdminPage() {
  const [load, reload] = useAdminLoad<AdminWorkshop[]>('/Workshop/Get?onlyPublished=false');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('tutti');
  const [onlyDrafts, setOnlyDrafts] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'date', direction: 'descending' });
  const [shown, setShown] = useState(PAGE);

  const rows: Row[] = useMemo(() => {
    if (load.state !== 'ready') return [];
    const today = dayKey(new Date().toISOString());
    return load.data.map(w => ({
      w,
      title: clean(w.title),
      place: clean(w.location?.name),
      sessions: sessionCount(programme(w)),
      materials: w.materials?.length ?? 0,
      upcoming: dayKey(w.eventDate) >= today,
      search: nameKey([w.title, w.location?.name, ...speakerNamesOf(w)].join(' ')),
    }));
  }, [load]);
  const years = useMemo(() => [...new Set(rows.map(r => yearOf(r.w.eventDate)))].sort().reverse(), [rows]);
  const first = rows.length ? Math.min(...rows.map(r => Number(yearOf(r.w.eventDate)))) : null;

  const q = nameKey(query);
  const visible = rows
    .filter(r => (year === 'tutti' || yearOf(r.w.eventDate) === year) && (!q || r.search.includes(q)) && (!onlyDrafts || r.w.published === false) && (!onlyFeatured || r.w.in_homepage))
    .sort((a, b) => {
      const d = sort.direction === 'ascending' ? 1 : -1;
      if (sort.key === 'title') return a.title.localeCompare(b.title, 'it') * d;
      if (sort.key === 'sessions') return (a.sessions - b.sessions) * d || b.w.eventDate.localeCompare(a.w.eventDate);
      return a.w.eventDate.localeCompare(b.w.eventDate) * d;
    });
  const onSort = (key: SortKey) => setSort(s => (s.key === key ? { key, direction: s.direction === 'ascending' ? 'descending' : 'ascending' } : { key, direction: key === 'title' ? 'ascending' : 'descending' }));
  const reset = () => { setQuery(''); setYear('tutti'); setOnlyDrafts(false); setOnlyFeatured(false); };
  const page = visible.slice(0, shown);
  const drafts = rows.filter(r => r.w.published === false).length;

  return (
    <>
      <PageHeader
        title="Eventi"
        description={load.state === 'ready' ? `${rows.length} ${rows.length === 1 ? 'evento' : 'eventi'}${first ? `, dal ${first} a oggi` : ''}${drafts ? ` · ${drafts} in bozza` : ''}.` : undefined}
        actions={<Link to="/admin/workshop/create" className={btn.primary}><AdminIcon name="plus" />Nuovo evento</Link>}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2.5" role="search">
        <SearchField aria-label="Cerca negli eventi" value={query} onChange={setQuery} className="relative w-full sm:w-80">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted"><AdminIcon name="search" /></span>
          <Input placeholder="Titolo, sede o relatore" className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-11 text-base text-navy outline-none placeholder:text-[#6b8399] hover:border-cyan-200 focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25 [&::-webkit-search-cancel-button]:hidden" />
        </SearchField>
        {years.length > MAX_YEAR_PILLS && (
          <Select aria-label="Anno" selectedKey={year} onSelectionChange={key => setYear(String(key ?? 'tutti'))} className="flex items-center gap-2">
            <Label className="sr-only">Anno</Label>
            <Button className={`${pill} min-w-36 justify-between`}>
              <SelectValue />
              <AdminIcon name="chevron" className="size-4" />
            </Button>
            <Popover className="max-h-72 min-w-[var(--trigger-width)] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
              <ListBox className="outline-none">
                <ListBoxItem id="tutti" textValue="Tutti gli anni" className="flex min-h-10 cursor-pointer items-center rounded-lg px-3 font-semibold outline-none data-[focused]:bg-cyan-50 data-[selected]:text-cyan-700">Tutti gli anni</ListBoxItem>
                {years.map(y => <ListBoxItem key={y} id={y} textValue={y} className="flex min-h-10 cursor-pointer items-center rounded-lg px-3 font-semibold tabular-nums outline-none data-[focused]:bg-cyan-50 data-[selected]:text-cyan-700">{y}</ListBoxItem>)}
              </ListBox>
            </Popover>
          </Select>
        )}
        {years.length > 1 && years.length <= MAX_YEAR_PILLS && (
          <ToggleButtonGroup aria-label="Anno" selectionMode="single" disallowEmptySelection selectedKeys={[year]} onSelectionChange={keys => setYear(String([...keys][0] ?? 'tutti'))} className="flex flex-wrap gap-2">
            <ToggleButton id="tutti" className={pill}>Tutti</ToggleButton>
            {years.map(y => <ToggleButton key={y} id={y} className={pill}>{y}</ToggleButton>)}
          </ToggleButtonGroup>
        )}
        <ToggleButton isSelected={onlyDrafts} onChange={setOnlyDrafts} className={pill}>Bozze{drafts > 0 && <span className="tabular-nums">{drafts}</span>}</ToggleButton>
        <ToggleButton isSelected={onlyFeatured} onChange={setOnlyFeatured} className={pill}>In evidenza</ToggleButton>
      </div>

      {load.state === 'error' && <div className="mt-5"><LoadError message={`Gli eventi non sono disponibili (${load.message}).`} onRetry={reload} /></div>}
      {load.state === 'loading' && <div className="mt-5 h-96 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" aria-hidden="true" />}

      {load.state === 'ready' && (
        <Panel className="mt-5 overflow-hidden">
          {visible.length ? (
            <>
              <table className="hidden w-full text-left md:table">
                <caption className="sr-only">Eventi, ordinati per {sort.key === 'title' ? 'titolo' : sort.key === 'sessions' ? 'numero di sessioni' : 'data'}</caption>
                <thead className="border-b border-line text-sm">
                  <tr>
                    <SortHeader label="Evento" column="title" sort={sort} onSort={onSort} className="pr-3 pl-4" />
                    <SortHeader label="Data" column="date" sort={sort} onSort={onSort} className="px-2" />
                    <th scope="col" className="px-3 font-semibold text-muted">Sede</th>
                    <SortHeader label="Sessioni" column="sessions" sort={sort} onSort={onSort} className="px-2 text-right" />
                    <th scope="col" className="px-3 text-right font-semibold text-muted">Materiali</th>
                    <th scope="col" className="px-3 font-semibold text-muted">Stato</th>
                    <th scope="col" className="w-28 pr-5"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page.map(row => {
                    const poster = contentUrl(row.w.image);
                    return (
                      <tr key={row.w.workshopId} className="group relative transition-colors hover:bg-cyan-50/60">
                        <td className="py-3 pr-3 pl-5">
                          <div className="flex items-center gap-3">
                            {poster ? <img src={poster} alt="" className="aspect-video w-20 shrink-0 rounded-lg object-cover" /> : <span className="aspect-video w-20 shrink-0 rounded-lg bg-[#eef3f7]" />}
                            <Link to={`/admin/workshop/${row.w.workshopId}`} className={`font-bold leading-snug after:absolute after:inset-0 hover:underline ${linkFocus}`}>{row.title}</Link>
                          </div>
                        </td>
                        <td className="px-3 whitespace-nowrap text-muted tabular-nums">{formatDate(row.w.eventDate)}</td>
                        <td className="px-3 text-muted">{row.place || '—'}</td>
                        <td className="px-3 text-right tabular-nums">{row.sessions}</td>
                        <td className={`px-3 text-right tabular-nums ${row.materials ? '' : 'text-muted'}`}>{row.materials || '—'}</td>
                        <td className="px-3"><StatusBadges row={row} /></td>
                        <td className="relative z-10 pr-4"><RowActions row={row} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden" aria-label="Eventi">
                {page.map(row => {
                  const poster = contentUrl(row.w.image);
                  return (
                    <li key={row.w.workshopId}>
                      <Link to={`/admin/workshop/${row.w.workshopId}`} className={`flex gap-3 p-4 ${linkFocus}`}>
                        {poster && <img src={poster} alt="" className="aspect-video w-24 shrink-0 rounded-lg object-cover" />}
                        <span className="min-w-0">
                          <span className="block font-bold leading-snug">{row.title}</span>
                          <span className="block text-sm text-muted">{formatWeekday(row.w.eventDate)}{row.place ? ` · ${row.place}` : ''}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusBadges row={row} /><span className="text-sm text-muted">{row.sessions} {row.sessions === 1 ? 'sessione' : 'sessioni'}</span></span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                <p className="text-sm text-muted">{page.length} di {visible.length}{visible.length < rows.length ? ` (su ${rows.length})` : ''} eventi</p>
                {visible.length > page.length && (
                  <Button onPress={() => setShown(n => n + PAGE)} className={btn.ghost}>Mostra altri {Math.min(PAGE, visible.length - page.length)}</Button>
                )}
              </div>
            </>
          ) : rows.length ? (
            <EmptyState icon="calendar" title="Nessun evento corrisponde ai filtri" actions={<Button onPress={reset} className={btn.secondary}>Azzera i filtri</Button>} />
          ) : (
            <EmptyState icon="calendar" title="Ancora nessun evento" actions={<Link to="/admin/workshop/create" className={btn.primary}><AdminIcon name="plus" />Nuovo evento</Link>}>
              <p>Crea il primo evento: titolo, data e sede bastano per partire.</p>
            </EmptyState>
          )}
        </Panel>
      )}
    </>
  );
}
