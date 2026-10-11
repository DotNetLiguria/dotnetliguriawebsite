import React from 'react';
import SiteLayout from '../SiteLayout';
import PageMeta from '../PageMeta';
import { GhostAction, LogoArc, PrimaryAction } from '../ui';

/** Public page for addresses that match no route: never indexed, always a way back. */
export default function NotFoundPage() {
  return (
    <SiteLayout>
      <PageMeta title="Pagina non trovata" description="L'indirizzo che hai aperto non esiste su DotNetLiguria." noindex />
      <section className="on-navy relative isolate overflow-hidden bg-navy text-white" aria-labelledby="not-found-title">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[75%] w-full" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:pb-24 lg:pt-16">
          <h1 id="not-found-title" className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">Pagina non trovata</h1>
          <p className="mt-4 max-w-2xl text-xl leading-relaxed text-cyan-50/90">
            L'indirizzo che hai aperto non esiste o non è più disponibile. Controlla il link oppure riparti dalla pagina iniziale o dall'archivio degli eventi.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <PrimaryAction to="/">Vai alla pagina iniziale</PrimaryAction>
            <GhostAction to="/workshops">Eventi passati</GhostAction>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
