import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Menu, MenuItem, MenuTrigger, Popover, ProgressBar } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { btn, focusRing, linkFocus } from '../ui';
import { useIsDesktop } from './listKit';
import { STEPS, StepId, stepIndexOf } from './eventModel';

// The ten steps of the event wizard, as the previous admin ordered them, in a bar that stays at the top while
// the page scrolls (as before). Steps already reached (and every earlier one) can be opened directly; the ones
// ahead open with "Avanti". Desktop draws the row with connectors; phones get "Passo 3 di 10", a progress bar
// and the reachable steps in a menu.

/** Sticky like the previous stepper: below the admin's top bar on phones, at the top of the content area on desktop. */
const sticky = 'sticky top-[74px] z-20 lg:top-2.5';

interface StepperProps {
  current: StepId;
  /** Index of the furthest step reached in this visit. */
  reached: number;
  hrefFor: (id: StepId) => string;
  onSelect: (id: StepId) => void;
}

type Mark = 'current' | 'reached' | 'ahead';
const markOf = (index: number, currentIndex: number, reached: number): Mark =>
  (index === currentIndex ? 'current' : index <= reached ? 'reached' : 'ahead');
const MARK_LABEL: Record<Mark, string> = { current: 'passo attuale', reached: 'raggiunto', ahead: 'non ancora raggiunto' };
const stepName = (index: number, label: string, mark: Mark) => `${index + 1}. ${label}, ${MARK_LABEL[mark]}`;

function StepMarker({ index, mark, className = 'size-8 text-sm' }: { index: number; mark: Mark; className?: string }) {
  const look = mark === 'current' ? 'bg-navy text-white' : mark === 'reached' ? 'bg-basil-50 text-basil-700' : 'border-2 border-line-strong bg-white text-muted';
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold tabular-nums ${look} ${className}`}>
      {mark === 'reached' ? <AdminIcon name="check" className="size-4" /> : index + 1}
    </span>
  );
}

function DesktopStepper({ current, reached, hrefFor }: StepperProps) {
  const currentIndex = stepIndexOf(current);
  return (
    <nav aria-label="Passaggi dell'evento" className={`${sticky} mt-6 rounded-2xl border border-line bg-white px-2 py-3`}>
      <ol className="flex items-start">
        {STEPS.map((step, index) => {
          const mark = markOf(index, currentIndex, reached);
          const body = (
            <>
              <StepMarker index={index} mark={mark} />
              <span className={`text-xs leading-tight sm:text-sm ${mark === 'current' ? 'font-bold text-navy' : mark === 'reached' ? 'font-semibold text-navy/80' : 'font-semibold text-muted'}`}>{step.label}</span>
            </>
          );
          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center">
              {index < STEPS.length - 1 && <span aria-hidden="true" className={`absolute top-4 left-1/2 h-0.5 w-full ${index < reached ? 'bg-basil-700/40' : 'bg-line'}`} />}
              {mark === 'ahead' ? (
                <span aria-label={stepName(index, step.label, mark)} className="relative z-10 flex min-w-0 max-w-full flex-col items-center gap-1.5 px-1 py-1 text-center">{body}</span>
              ) : (
                <Link
                  to={hrefFor(step.id)}
                  aria-current={mark === 'current' ? 'step' : undefined}
                  aria-label={stepName(index, step.label, mark)}
                  className={`relative z-10 flex min-w-0 max-w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center transition-colors hover:bg-cyan-50/60 ${linkFocus}`}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PhoneStepper({ current, reached, onSelect }: StepperProps) {
  const index = stepIndexOf(current);
  const step = STEPS[index];
  const total = STEPS.length;
  const reachable = STEPS.filter((_, i) => i <= reached);
  return (
    <nav aria-label="Passaggi dell'evento" className={`${sticky} mt-6 rounded-2xl border border-line bg-white p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-bold"><span className="text-muted">Passo {index + 1} di {total}</span> · {step.label}</p>
        <MenuTrigger>
          <Button className={`${btn.ghost} shrink-0`}>Passaggi<AdminIcon name="chevron" className="size-4" /></Button>
          <Popover placement="bottom end" offset={4} className="min-w-72 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
            <Menu aria-label="Passaggi raggiunti" onAction={key => onSelect(key as StepId)} className="outline-none">
              {reachable.map((item, i) => {
                const mark = markOf(i, index, reached);
                return (
                  <MenuItem key={item.id} id={item.id} textValue={stepName(i, item.label, mark)} aria-label={stepName(i, item.label, mark)} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 outline-none data-[focused]:bg-cyan-50 ${mark === 'current' ? 'bg-cyan-50/60' : ''}`}>
                    <StepMarker index={i} mark={mark} className="size-7 text-xs" />
                    <span className="min-w-0 flex-1 font-semibold">{item.label}</span>
                  </MenuItem>
                );
              })}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <ProgressBar aria-label={`Passo ${index + 1} di ${total}`} value={index + 1} maxValue={total} className="mt-3 block">
        {({ percentage }) => (
          <span className="block h-1.5 overflow-hidden rounded-full bg-[#eef3f7]">
            <span className="block h-full rounded-full bg-navy transition-[width] motion-reduce:transition-none" style={{ width: `${percentage ?? 0}%` }} />
          </span>
        )}
      </ProgressBar>
    </nav>
  );
}

export function Stepper(props: StepperProps) {
  const desktop = useIsDesktop();
  return desktop ? <DesktopStepper {...props} /> : <PhoneStepper {...props} />;
}

/**
 * Indietro / Avanti like the previous Previous / Next; the last step saves ("Save changes"). While that save
 * runs, Indietro is disabled too, as Previous was.
 */
export function StepNav({ current, busy, canSave = true, onMove, onSave }: { current: StepId; busy: boolean; canSave?: boolean; onMove: (id: StepId) => void; onSave: () => void }) {
  const index = stepIndexOf(current);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <Button onPress={() => previous && onMove(previous.id)} isDisabled={!previous || busy} className={btn.secondary}>
        <AdminIcon name="back" />Indietro{previous && <span className="sr-only">: {previous.label}</span>}
      </Button>
      {next ? (
        <Button onPress={() => onMove(next.id)} className={btn.primary}>Avanti<span className="sr-only">: {next.label}</span><AdminIcon name="arrow" /></Button>
      ) : (
        <Button onPress={onSave} isDisabled={busy || !canSave} className={btn.primary}><AdminIcon name="check" />{busy ? 'Salvataggio…' : 'Salva modifiche'}</Button>
      )}
    </div>
  );
}

/**
 * The previous "back to top" button: it appears once the page has scrolled more than 300px and brings it back
 * to the top (the window on phones, the content area of the admin from the lg breakpoint).
 */
export function ScrollTopButton({ onTop }: { onTop?: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const area = document.getElementById('contenuto-admin');
    const update = () => setShown(window.scrollY > 300 || (area?.scrollTop ?? 0) > 300);
    window.addEventListener('scroll', update);
    area?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('scroll', update);
      area?.removeEventListener('scroll', update);
    };
  }, []);
  if (!shown) return null;
  const toTop = () => {
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
    document.getElementById('contenuto-admin')?.scrollTo({ top: 0, behavior });
    onTop?.();
  };
  return (
    <Button onPress={toTop} aria-label="Torna su" className={`fixed right-4 bottom-20 z-30 grid size-12 cursor-pointer place-items-center rounded-full bg-navy text-white shadow-lift transition-colors data-[hovered]:bg-cyan-700 lg:right-6 lg:bottom-6 ${focusRing}`}>
      <AdminIcon name="chevron" className="size-6 rotate-180" />
    </Button>
  );
}
