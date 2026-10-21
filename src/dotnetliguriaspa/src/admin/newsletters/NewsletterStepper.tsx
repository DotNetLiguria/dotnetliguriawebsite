import React from 'react';
import { linkFocus } from '../ui';

export type NewsletterStep = 1 | 2 | 3 | 4 | 5;
export const newsletterSteps: { step: NewsletterStep; label: string }[] = [
  { step: 1, label: 'Crea o apri' },
  { step: 2, label: 'Testo e approvazione' },
  { step: 3, label: 'Invio di prova' },
  { step: 4, label: 'Invio agli iscritti' },
  { step: 5, label: 'Cronologia' },
];

export default function NewsletterStepper({ current, reachable, completed, onSelect }: {
  current: NewsletterStep;
  reachable: (step: NewsletterStep) => boolean;
  completed: (step: NewsletterStep) => boolean;
  onSelect: (step: NewsletterStep) => void;
}) {
  return <nav aria-label="Passi della newsletter">
    <ol className="grid gap-2 sm:grid-cols-5">{newsletterSteps.map(({ step, label }) => {
      const active = step === current;
      const enabled = reachable(step);
      const done = completed(step);
      return <li key={step}>
        <button type="button" disabled={!enabled} aria-current={active ? 'step' : undefined} onClick={() => onSelect(step)}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${linkFocus} ${active ? 'border-cyan-700 bg-cyan-50 text-navy' : enabled ? 'border-line bg-white text-navy hover:bg-cyan-50' : 'cursor-not-allowed border-line bg-white text-muted opacity-60'}`}>
          <span aria-hidden="true" className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-basil-50 text-navy' : active ? 'bg-cyan-700 text-white' : 'bg-line/40'}`}>{done ? '✓' : step}</span>
          <span>{step}. {label}{done ? <span className="sr-only"> (completato)</span> : null}{!enabled ? <span className="sr-only"> (non ancora disponibile)</span> : null}</span>
        </button>
      </li>;
    })}</ol>
  </nav>;
}
