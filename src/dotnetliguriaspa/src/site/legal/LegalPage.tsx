import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import SiteLayout from '../SiteLayout';
import PageMeta from '../PageMeta';
import { Badge, LogoArc } from '../ui';
import { formatDate } from '../format';
import { LEGAL_PAGES, LEGAL_UPDATED } from './legalFacts';

// Shared frame and building blocks of the privacy, terms and cookie pages.

const linkClass = 'font-bold text-cyan-700 underline decoration-2 underline-offset-4 hover:text-navy';

/** Link to another page of the site, inside running text. */
export function LegalLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className={linkClass}>{children}</Link>;
}

/** Link to another website, inside running text. It opens in a new tab and says so. */
export function LegalExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
      {children}{' '}<span className="sr-only">(si apre in una nuova scheda)</span>
    </a>
  );
}

/** A detail the association still has to supply: marked, never invented. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span>
      <Badge tone="todo">Da completare</Badge>
      <span className="ml-2 font-semibold text-muted">{children}</span>
    </span>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-3xl font-bold leading-tight">{title}</h2>
      {/* Plain lists get bullets; lists with their own classes (cards) style themselves. */}
      <div className="mt-4 space-y-4 text-lg leading-relaxed text-navy/85 [&_ul:not([class])]:list-disc [&_ul:not([class])]:space-y-2 [&_ul:not([class])]:pl-6">
        {children}
      </div>
    </section>
  );
}

export function LegalSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-4">
      <h3 className="text-xl font-bold leading-snug text-navy">{title}</h3>
      {children}
    </div>
  );
}

/** The few sentences that matter, before the details. */
export function LegalSummary({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="in-breve" className="rounded-3xl bg-basil-50 p-7">
      <h2 id="in-breve" className="text-2xl font-bold">In breve</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-lg leading-relaxed text-navy/90">{children}</ul>
    </section>
  );
}

/** Controller and contact details, shared by the three pages so that they are completed in one pass. */
export function ControllerDetails({ withDpo = false }: { withDpo?: boolean }) {
  return (
    <dl className="grid gap-3">
      <div>
        <dt className="font-bold text-navy">Titolare</dt>
        <dd>DotNetLiguria, community .NET della Liguria</dd>
      </div>
      <div>
        <dt className="font-bold text-navy">Dati dell'associazione</dt>
        <dd><Placeholder>denominazione completa, forma giuridica, codice fiscale e sede legale</Placeholder></dd>
      </div>
      <div>
        <dt className="font-bold text-navy">Contatto</dt>
        <dd><Placeholder>indirizzo email a cui scrivere per privacy e segnalazioni</Placeholder></dd>
      </div>
      {withDpo && (
        <div>
          <dt className="font-bold text-navy">Responsabile della protezione dei dati (DPO)</dt>
          <dd><Placeholder>nominativo e contatto, oppure indicare che non è stato nominato</Placeholder></dd>
        </div>
      )}
    </dl>
  );
}

export interface LegalPageProps {
  /** Page title and h1, e.g. "Informativa sulla privacy". */
  title: string;
  /** One sentence for search results and the lead of the page. */
  description: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, description, children }: LegalPageProps) {
  const { pathname } = useLocation();
  return (
    <SiteLayout>
      <PageMeta title={title} description={description} />
      <section className="on-navy relative isolate overflow-hidden bg-navy text-white" aria-labelledby="legal-title">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[75%] w-full" />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:pb-20 lg:pt-16">
          <h1 id="legal-title" className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-xl leading-relaxed text-cyan-50/90">{description}</p>
          <p className="mt-5 font-semibold text-cyan-50/90">
            Ultimo aggiornamento: <time dateTime={LEGAL_UPDATED}>{formatDate(`${LEGAL_UPDATED}T12:00:00Z`)}</time>
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,70ch)_minmax(0,18rem)] lg:justify-between lg:py-20">
        <div className="min-w-0 space-y-12">{children}</div>
        <nav aria-labelledby="legal-links" className="self-start rounded-3xl bg-cyan-50 p-7 lg:sticky lg:top-28">
          <h2 id="legal-links" className="text-xl font-bold">Informative</h2>
          <ul className="mt-2 grid gap-1">
            {LEGAL_PAGES.map(page => (
              <li key={page.to}>
                <Link
                  to={page.to}
                  aria-current={pathname === page.to ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center ${linkClass} ${pathname === page.to ? 'text-navy' : ''}`}
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </SiteLayout>
  );
}
