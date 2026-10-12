import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Menu, MenuItem, MenuTrigger, Popover, ProgressBar } from 'react-aria-components';
import { AdminIcon } from '../icons';
import { btn, focusRing, linkFocus } from '../ui';
import { useIsDesktop } from './listKit';
import { STEPS, STEP_STATE_LABEL, StepId, StepState, StepStatus } from './eventModel';

// The event card is a non-linear stepper: six numbered steps, each reachable at any time, each showing whether
// it is done, still to do or merely optional. Desktop draws them in a row with connectors; phones get a compact
// header with a progress bar and the list of steps in a menu.

interface StepperProps {
  current: StepId;
  statuses: StepStatus[];
  hrefFor: (id: StepId) => string;
  onSelect: (id: StepId) => void;
}

const statusOf = (statuses: StepStatus[], id: StepId) => statuses.find(status => status.id === id) ?? { id, state: 'todo' as StepState, detail: '' };
/** Accessible name of a step: "2. Agenda, completato" (the visible label is part of it). */
const stepName = (index: number, label: string, state: StepState, current = false) =>
  `${index + 1}. ${label}, ${STEP_STATE_LABEL[state]}${current ? ', passo attuale' : ''}`;

function StepMarker({ index, state, current, className = 'size-8 text-sm' }: { index: number; state: StepState; current: boolean; className?: string }) {
  const look = current
    ? 'bg-navy text-white'
    : state === 'done' ? 'bg-basil-50 text-basil-700'
      : state === 'optional' ? 'border-2 border-dashed border-line-strong bg-white text-muted' : 'border-2 border-line-strong bg-white text-muted';
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold tabular-nums ${look} ${className}`}>
      {state === 'done' && !current ? <AdminIcon name="check" className="size-4" /> : index + 1}
    </span>
  );
}

function DesktopStepper({ current, statuses, hrefFor }: StepperProps) {
  return (
    <nav aria-label="Passaggi dell'evento" className="mt-6">
      <ol className="flex items-start">
        {STEPS.map((step, index) => {
          const status = statusOf(statuses, step.id);
          const isCurrent = step.id === current;
          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center">
              {index < STEPS.length - 1 && <span aria-hidden="true" className={`absolute top-4 left-1/2 h-0.5 w-full ${status.state === 'done' ? 'bg-basil-700/40' : 'bg-line'}`} />}
              <Link
                to={hrefFor(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={stepName(index, step.label, status.state)}
                className={`relative z-10 flex min-w-0 max-w-full flex-col items-center gap-1.5 rounded-xl px-2 py-1 text-center transition-colors hover:bg-cyan-50/60 ${linkFocus}`}
              >
                <StepMarker index={index} state={status.state} current={isCurrent} />
                <span className={`text-sm leading-tight ${isCurrent ? 'font-bold text-navy' : 'font-semibold text-muted'}`}>{step.label}</span>
                <span className={`text-xs ${status.state === 'done' ? 'text-basil-700' : 'text-muted'}`}>{status.detail}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PhoneStepper({ current, statuses, onSelect }: StepperProps) {
  const index = STEPS.findIndex(step => step.id === current);
  const step = STEPS[index];
  const total = STEPS.length;
  return (
    <nav aria-label="Passaggi dell'evento" className="mt-6 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-bold"><span className="text-muted">Passo {index + 1} di {total}</span> · {step.label}</p>
        <MenuTrigger>
          <Button className={`${btn.ghost} shrink-0`}>Tutti i passaggi<AdminIcon name="chevron" className="size-4" /></Button>
          <Popover placement="bottom end" offset={4} className="min-w-72 rounded-xl border border-line bg-white p-1.5 shadow-lift outline-none">
            <Menu aria-label="Passaggi dell'evento" onAction={key => onSelect(key as StepId)} className="outline-none">
              {STEPS.map((item, i) => {
                const status = statusOf(statuses, item.id);
                const isCurrent = item.id === current;
                return (
                  <MenuItem key={item.id} id={item.id} textValue={stepName(i, item.label, status.state)} aria-label={stepName(i, item.label, status.state, isCurrent)} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 outline-none data-[focused]:bg-cyan-50 ${isCurrent ? 'bg-cyan-50/60' : ''}`}>
                    <StepMarker index={i} state={status.state} current={isCurrent} className="size-7 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.label}</span>
                      <span className="block text-sm text-muted">{status.detail}{isCurrent ? ' · passo attuale' : ''}</span>
                    </span>
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

/** Numbered steps of the event card; every step is a link, so the hash and the browser history follow. */
export function Stepper(props: StepperProps) {
  const desktop = useIsDesktop();
  return desktop ? <DesktopStepper {...props} /> : <PhoneStepper {...props} />;
}

/** Indietro / Avanti at the end of a step. "Avanti" is the step's primary action only when it has no other. */
export function StepNav({ current, onMove }: { current: StepId; onMove: (id: StepId) => void }) {
  const index = STEPS.findIndex(step => step.id === current);
  const step = STEPS[index];
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <span>
        {previous && (
          <Button onPress={() => onMove(previous.id)} className={`${btn.secondary} ${focusRing}`}>
            <AdminIcon name="back" />Indietro<span className="sr-only">: {previous.label}</span>
          </Button>
        )}
      </span>
      {next && (
        <Button onPress={() => onMove(next.id)} className={step.hasPrimaryAction ? btn.secondary : btn.primary}>
          Avanti: {next.label}<AdminIcon name="arrow" />
        </Button>
      )}
    </div>
  );
}
