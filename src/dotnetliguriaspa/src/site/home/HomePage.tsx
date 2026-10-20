import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import SiteLayout from '../SiteLayout';
import PageMeta from '../PageMeta';
import JsonLd from '../JsonLd';
import { organizationJsonLd } from '../structuredData';
import EventCard from '../EventCard';
import { ExternalLink, Icon } from '../icons';
import { Badge, GhostAction, LogoArc, OutlineAction, PrimaryAction, SectionTitle } from '../ui';
import { SiteBoardMember, contentUrl, getActiveBoard, getFeaturedWorkshop, getPublishedWorkshops } from '../siteApi';
import { clean, eventPhase, formatDate } from '../format';
import { webUrl } from '../links';
import { publicQuestionnaireApi } from '../../questionnaire/api';
import { useLoad } from '../useLoad';
import EventProgramme, { triggerLink } from '../event/EventProgramme';
import EventInfoCard from '../event/EventInfoCard';
import { profilePhotoUrl } from '../speakerPhotos';

// Approved presentation copy of the current site.
const ABOUT =
  'DotNet Liguria è la prima community .NET della Liguria, nata per promuovere la condivisione di conoscenze, esperienze e networking tra sviluppatori, professionisti e appassionati del mondo Microsoft .NET. Organizziamo eventi, workshop e incontri per favorire la crescita tecnica e la collaborazione sul territorio.';

/** Scrolls to /#section links once the target exists (menu entries point at #evidence and #team). */
function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || !ready) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, ready]);
}

function TeamCard({ member }: { member: SiteBoardMember }) {
  const photo = profilePhotoUrl(member.profileImageUrl);
  const bio = clean(member.shortBio) || clean(member.fullBio);
  const long = bio.length > 170;
  const preview = long ? `${bio.slice(0, bio.lastIndexOf(' ', 160))}…` : bio;
  const name = clean(member.name);
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  // Stored links may lack the scheme; anything that is not a web address is dropped.
  const links = [
    ['Blog', member.blogHtml], ['LinkedIn', member.lInkedinUrl], ['GitHub', member.gitHubUrl],
    ['X', member.twitterUrl], ['Facebook', member.faceboookUrl], ['Instagram', member.instagramUrl],
  ].map(([label, url]) => [label, webUrl(url)]).filter((link): link is [string, string] => !!link[1]);

  return (
    <li className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-card">
      {photo
        ? (
          // Uniform portrait style: soft, low-contrast duotone in the logo navy and cyan.
          <div className="relative isolate aspect-[4/3] overflow-hidden bg-cyan-50 after:pointer-events-none after:absolute after:inset-0 after:bg-navy after:opacity-55 after:mix-blend-screen after:content-['']">
            <img src={photo} alt="" loading="lazy" className="size-full object-cover object-[50%_35%] mix-blend-multiply brightness-105 contrast-90 grayscale" />
          </div>
        )
        : <span className="grid aspect-[4/3] place-items-center bg-cyan-50 text-4xl font-bold text-cyan-700" aria-hidden="true">{initials}</span>}
      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="text-xl font-bold leading-tight">{name}</h3>
        {member.description && <p className="font-bold text-basil-700">{clean(member.description)}</p>}
        {bio && !long && <p className="text-base leading-relaxed text-navy/85">{bio}</p>}
        {long && (
          <Disclosure className="flex flex-1 flex-col">
            {({ isExpanded }) => (
              <>
                {!isExpanded && <p className="text-base leading-relaxed text-navy/85">{preview}</p>}
                <DisclosurePanel><p className="text-base leading-relaxed text-navy/85">{bio}</p></DisclosurePanel>
                {/* Explicit name: an sr-only suffix loses its leading space in name computation. */}
                <Button
                  slot="trigger"
                  aria-label={`${isExpanded ? 'Mostra meno' : 'Leggi di più'} su ${name}`}
                  className={`mt-auto self-start pt-2 ${triggerLink}`}
                >
                  {isExpanded ? 'Mostra meno' : 'Leggi di più'}
                </Button>
              </>
            )}
          </Disclosure>
        )}
        {links.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {links.map(([label, url]) => (
              <li key={label}>
                <ExternalLink href={url} className="min-h-11 rounded-full bg-cyan-50 px-4 text-sm font-bold text-cyan-700 no-underline hover:underline">{label}</ExternalLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function ToBeCompleted({ id, icon, title, tone, children }: { id: string; icon: 'mic' | 'users'; title: string; tone: 'basil' | 'cyan'; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`rounded-3xl p-8 sm:p-10 ${tone === 'basil' ? 'bg-basil-50' : 'bg-cyan-50'}`}>
      <div className="flex items-center gap-3">
        <Icon name={icon} className={`size-7 ${tone === 'basil' ? 'text-basil-700' : 'text-cyan-700'}`} />
        <Badge tone="todo">Da completare</Badge>
      </div>
      <h2 id={`${id}-title`} className="mt-5 text-3xl font-bold">{title}</h2>
      <p className="mt-3 text-lg leading-relaxed text-navy/85">{children}</p>
    </section>
  );
}

export default function HomePage() {
  const [featured, retryFeatured] = useLoad(getFeaturedWorkshop);
  const [workshops, retryWorkshops] = useLoad(getPublishedWorkshops);
  const [board] = useLoad(getActiveBoard);

  const newest = useMemo(
    () => workshops.state === 'ready' ? [...workshops.data].sort((a, b) => b.eventDate.localeCompare(a.eventDate)) : [],
    [workshops],
  );
  const featuredWorkshop = featured.state === 'ready' ? featured.data : null;
  const latest = newest[0] ?? null;
  // The evidence section shows the featured event, or the latest one when nothing is featured.
  const shown = featuredWorkshop ?? (featured.state === 'loading' ? null : latest);
  const phase = shown ? eventPhase(shown.eventDate) : null;
  const members = board.state === 'ready' ? [...board.data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const firstYear = newest.length ? new Date(newest[newest.length - 1].eventDate).getFullYear() : null;

  const [questionnaire] = useLoad(
    signal => shown
      ? publicQuestionnaireApi.byWorkshop(shown.workshopId, (input, init) => fetch(input, { ...init, signal })).catch(() => null)
      : Promise.resolve(null),
    shown?.workshopId ?? null,
  );
  const commentsOpen = questionnaire.state === 'ready' && questionnaire.data?.availability === 'Open';
  useHashScroll(featured.state !== 'loading' && workshops.state !== 'loading');

  let heroCard: React.ReactNode;
  if (featured.state === 'loading') {
    heroCard = (
      <div className="rounded-3xl bg-white p-8 shadow-card" role="status">
        <p className="text-lg font-semibold text-muted">Caricamento del prossimo evento…</p>
      </div>
    );
  } else if (featured.state === 'error') {
    heroCard = (
      <div role="alert" className="rounded-3xl bg-white p-8 text-navy shadow-card">
        <h2 className="text-2xl font-bold">Non riusciamo a caricare il prossimo evento</h2>
        <p className="mt-2 text-muted">{featured.message}. Riprova tra qualche istante: il resto della pagina è disponibile.</p>
        <Button
          onPress={retryFeatured}
          className="mt-5 inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 border-navy px-6 font-bold text-navy outline-none data-[hovered]:bg-navy data-[hovered]:text-white"
        >
          Riprova
        </Button>
      </div>
    );
  } else if (featuredWorkshop) {
    // Right under the page title, so the card heading is an h2.
    heroCard = <EventCard workshop={featuredWorkshop} large headingLevel={2} />;
  } else {
    heroCard = (
      <div className="relative overflow-hidden rounded-3xl bg-white p-8 text-navy shadow-card sm:p-10">
        <Badge tone="next">Prossimo evento</Badge>
        <h2 className="mt-4 text-3xl font-bold leading-tight">Il prossimo incontro è in preparazione</h2>
        <p className="mt-3 text-lg leading-relaxed text-navy/85">Data, sede e programma saranno pubblicati qui appena confermati.</p>
        {latest && (
          <div className="mt-8 flex items-center gap-4 rounded-2xl bg-cyan-50 p-4">
            {contentUrl(latest.image) && <img src={contentUrl(latest.image)!} alt="" className="aspect-video w-28 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">Ultimo evento · {formatDate(latest.eventDate)}</p>
              <p className="font-bold leading-snug"><a href="#evidence" className="inline-flex min-h-11 items-center text-navy no-underline hover:underline">{clean(latest.title)}</a></p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <SiteLayout>
      <PageMeta />
      <JsonLd data={organizationJsonLd(window.location.origin)} />
      <section id="about" className="on-navy relative isolate overflow-hidden bg-navy text-white" aria-labelledby="hero-title">
        <LogoArc className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] w-full" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-20">
          <div>
            <h1 id="hero-title" className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              La community <span className="text-basil">.NET</span> della Liguria
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-cyan-50/90">{ABOUT}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              {shown && <PrimaryAction href="#evidence">{featuredWorkshop ? "Scopri l'evento" : "Rivedi l'ultimo evento"}</PrimaryAction>}
              <GhostAction to="/workshops">Eventi passati</GhostAction>
            </div>
          </div>
          {heroCard}
        </div>
      </section>

      {shown && (
        <section id="evidence" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="evidence-title">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={phase === 'done' ? 'done' : 'planned'}>{phase === 'done' ? 'Concluso' : phase === 'today' ? 'Oggi' : 'In programma'}</Badge>
            <span className="font-semibold text-muted">{featuredWorkshop ? 'Evento in evidenza' : 'Ultimo evento'}</span>
          </div>
          <h2 id="evidence-title" className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">{clean(shown.title)}</h2>
          {clean(shown.description) && <p className="mt-5 max-w-3xl text-xl leading-relaxed text-navy/85">{clean(shown.description)}</p>}
          <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <h3 className="text-2xl font-bold">Programma</h3>
              <EventProgramme workshop={shown} />
            </div>
            <EventInfoCard workshop={shown} commentsOpen={commentsOpen} />
          </div>
        </section>
      )}

      <section id="recenti" className="bg-cyan-50 py-20 lg:py-28" aria-labelledby="recenti-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionTitle id="recenti-title" intro={firstYear ? `${newest.length} eventi nell'archivio, dal ${firstYear} a oggi.` : undefined}>Eventi recenti</SectionTitle>
            </div>
            <OutlineAction to="/workshops">Tutti gli eventi</OutlineAction>
          </div>
          {workshops.state === 'loading' && <p className="mt-10 text-lg text-muted" role="status">Caricamento degli eventi…</p>}
          {workshops.state === 'error' && (
            <div className="mt-10" role="status">
              <p className="text-lg">L'elenco degli eventi non è disponibile ({workshops.message}).</p>
              <Button onPress={retryWorkshops} className={`mt-2 ${triggerLink}`}>Riprova</Button>
            </div>
          )}
          {workshops.state === 'ready' && newest.length === 0 && <p className="mt-10 text-lg text-muted">Nessun evento pubblicato.</p>}
          {newest.length > 0 && (
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {newest.slice(0, 6).map(workshop => <li key={workshop.workshopId} className="flex"><EventCard workshop={workshop} /></li>)}
            </ul>
          )}
        </div>
      </section>

      <section id="team" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="team-title">
        <SectionTitle id="team-title" intro="Le persone che organizzano DotNetLiguria e curano gli eventi.">Il team</SectionTitle>
        {board.state === 'loading' && <p className="mt-10 text-lg text-muted" role="status">Caricamento del team…</p>}
        {board.state === 'error' && <p className="mt-10 text-lg" role="status">Il team non è disponibile ({board.message}).</p>}
        {board.state === 'ready' && members.length === 0 && <p className="mt-10 text-lg text-muted">Nessun membro del team disponibile.</p>}
        {members.length > 0 && (
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {members.map(member => <TeamCard key={member.boardId} member={member} />)}
          </ul>
        )}
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-24 sm:px-6 md:grid-cols-2">
        <ToBeCompleted id="proponi" icon="mic" title="Proponi un talk" tone="basil">
          Il sito non ha ancora un canale per ricevere le proposte di talk. La sezione si attiva quando il backend sarà disponibile.
        </ToBeCompleted>
        <ToBeCompleted id="canali" icon="users" title="Seguici" tone="cyan">
          I canali ufficiali della community (social, newsletter, video) non sono ancora gestiti dal sito.
        </ToBeCompleted>
      </div>
    </SiteLayout>
  );
}
