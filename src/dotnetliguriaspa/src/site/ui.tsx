import React from 'react';
import { Link } from 'react-router-dom';
import { Icon, newTabLabel } from './icons';

// Shared visual pieces of the public site.

type Action = { to?: string; href?: string; external?: boolean; children: React.ReactNode; className?: string };

function ActionLink({ to, href, external, children, className = '', icon }: Action & { icon: boolean }) {
  const text = typeof children === 'string' ? children : '';
  const content = (
    <>
      {children}
      {icon && <Icon name={external ? 'external' : 'arrow'} />}
      {external && !text && <span className="sr-only">(si apre in una nuova scheda)</span>}
    </>
  );
  if (to) return <Link to={to} className={className}>{content}</Link>;
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': text ? newTabLabel(text) : undefined } : {})}
    >
      {content}
    </a>
  );
}

const pill = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-bold no-underline transition';

export const PrimaryAction = (props: Action) => (
  <ActionLink {...props} icon className={`${pill} bg-site-green text-navy shadow-card hover:-translate-y-0.5 hover:shadow-lift ${props.className ?? ''}`} />
);

/** Outline action for navy backgrounds. */
export const GhostAction = (props: Action) => (
  <ActionLink {...props} icon={false} className={`${pill} border-2 border-white/70 text-white hover:border-white hover:bg-white/10 ${props.className ?? ''}`} />
);

/** Outline action for light backgrounds. */
export const OutlineAction = (props: Action) => (
  <ActionLink {...props} icon className={`${pill} border-2 border-navy text-navy hover:bg-navy hover:text-white ${props.className ?? ''}`} />
);

export type BadgeTone = 'done' | 'planned' | 'today' | 'next' | 'todo';

const BADGE: Record<BadgeTone, string> = {
  done: 'bg-cyan-50 text-cyan-700',
  planned: 'bg-site-green text-navy',
  today: 'bg-site-green text-navy',
  next: 'bg-basil-50 text-basil-700',
  todo: 'border-2 border-dashed border-muted/50 text-muted py-0.5',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${BADGE[tone]}`}>{children}</span>;
}

/** The logo's brush arc, as a decorative motif. */
export function LogoArc({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 420" fill="none" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g className="arc-draw" strokeLinecap="round">
        <path d="M-60 430 C 380 420, 860 230, 1260 40" stroke="#00A8DF" strokeWidth={34} opacity={0.6} />
        <path d="M-40 455 C 400 445, 880 265, 1270 80" stroke="#8FD3EC" strokeWidth={8} opacity={0.5} />
      </g>
    </svg>
  );
}

export function SectionTitle({ id, children, intro }: { id: string; children: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="text-4xl font-bold leading-tight sm:text-5xl">{children}</h2>
      {intro && <p className="mt-3 max-w-2xl text-xl text-navy/85">{intro}</p>}
    </>
  );
}
