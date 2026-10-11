import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import SiteLayout from '../SiteLayout';
import EventCard from '../EventCard';
import ScrollTopButton from '../ScrollTopButton';
import { LogoArc } from '../ui';
import { SiteWorkshop, getPublishedWorkshops, isAbortError } from '../siteApi';
import { dayKey } from '../format';

type Load = { state: 'loading' } | { state: 'ready'; data: SiteWorkshop[] } | { state: 'error'; message: string };

const ALL = 'tutti';
const yearOf = (workshop: SiteWorkshop) => Number(dayKey(workshop.eventDate).slice(0, 4));
const focusRing = 'outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700';

export default function EventsPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ state: 'loading' });
    getPublishedWorkshops(controller.signal)
      .then(data => setLoad({ state: 'ready', data }))
      .catch(error => {
        if (isAbortError(error)) return;
        console.error('Events request failed:', error);
        setLoad({ state: 'error', message: error instanceof Error ? error.message : 'Errore di rete' });
      });
    return () => controller.abort();
  }, [attempt]);


  const newest = useMemo(
    () => load.state === 'ready' ? [...load.data].sort((a, b) => b.eventDate.localeCompare(a.eventDate)) : [],
    [load],
  );
  const years = useMemo(() => [...new Set(newest.map(yearOf))], [newest]);
  const requested = params.get('anno');
  const selected = requested && years.includes(Number(requested)) ? requested : ALL;
  const visibleYears = selected === ALL ? years : [Number(selected)];
  const firstYear = years.length ? years[years.length - 1] : null;

  const choose = useCallback((key: string) => {
    setParams(key === ALL ? {} : { anno: key }, { replace: true });
  }, [setParams]);

  const chip = `inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-5 font-bold transition ${focusRing} border-navy/20 bg-white text-navy data-[hovered]:border-navy data-[selected]:border-navy data-[selected]:bg-navy data-[selected]:text-white`;

  return (
    <SiteLayout>
      <section className="on-navy relative isolate overflow-hidden bg-navy text-white" aria-labelledby="events-title">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[75%] w-full" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:pb-24 lg:pt-16">
          <h1 id="events-title" className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">Eventi passati</h1>
          <p className="mt-4 max-w-2xl text-xl leading-relaxed text-cyan-50/90">
            {load.state === 'ready' && firstYear
              ? `Tutti gli eventi della community: ${newest.length} incontri dal ${firstYear} a oggi, con programma, relatori e materiali.`
              : 'Tutti gli eventi della community, con programma, relatori e materiali.'}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {load.state === 'loading' && <p className="text-lg text-muted" role="status">Caricamento degli eventi…</p>}

        {load.state === 'error' && (
          <div role="alert" className="max-w-2xl rounded-3xl bg-cyan-50 p-8">
            <h2 className="text-2xl font-bold">Non riusciamo a caricare gli eventi</h2>
            <p className="mt-2 text-muted">{load.message}. Riprova tra qualche istante.</p>
            <Button
              onPress={() => setAttempt(n => n + 1)}
              className={`mt-5 inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 border-navy px-6 font-bold text-navy data-[hovered]:bg-navy data-[hovered]:text-white ${focusRing}`}
            >
              Riprova
            </Button>
          </div>
        )}

        {load.state === 'ready' && newest.length === 0 && <p className="text-lg text-muted">Nessun evento trovato.</p>}

        {newest.length > 0 && (
          <>
            {years.length > 1 && (
              <ToggleButtonGroup
                aria-label="Filtra per anno"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[selected]}
                onSelectionChange={keys => {
                  const [key] = [...keys];
                  if (key !== undefined) choose(String(key));
                }}
                className="flex flex-wrap gap-2"
              >
                <ToggleButton id={ALL} className={chip}>Tutti gli anni</ToggleButton>
                {years.map(year => <ToggleButton key={year} id={String(year)} className={chip}>{year}</ToggleButton>)}
              </ToggleButtonGroup>
            )}

            {visibleYears.map(year => {
              const ofYear = newest.filter(workshop => yearOf(workshop) === year);
              return (
                <section key={year} className="mt-14 first-of-type:mt-10" aria-labelledby={`anno-${year}`}>
                  <div className="flex items-baseline gap-3 border-b border-line pb-3">
                    <h2 id={`anno-${year}`} className="text-4xl font-bold">{year}</h2>
                    <span className="text-lg font-semibold text-muted">{ofYear.length} {ofYear.length === 1 ? 'evento' : 'eventi'}</span>
                  </div>
                  <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {ofYear.map(workshop => <li key={workshop.workshopId} className="flex"><EventCard workshop={workshop} /></li>)}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>

      <ScrollTopButton />
    </SiteLayout>
  );
}
