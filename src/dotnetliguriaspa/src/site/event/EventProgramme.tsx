import React from 'react';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import { SiteTrack, SiteWorkshop } from '../siteApi';
import { clean, formatTimeRange } from '../format';
import { Icon } from '../icons';

const LOGISTICS = /^(registrazione|q\s*&\s*a|saluto|saluti|pausa|chiusura)/i;
export const triggerLink = 'inline-flex min-h-11 cursor-pointer items-center gap-1 font-bold text-cyan-700 underline decoration-2 underline-offset-4 outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700';

export const sortedTracks = (workshop: SiteWorkshop) =>
  [...(workshop.tracks ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));

/** Speaker names of a workshop, in programme order, without duplicates. */
export const speakerNames = (workshop: SiteWorkshop) => {
  const names: string[] = [];
  for (const track of sortedTracks(workshop)) {
    for (const name of clean(track.speakersName).split(/\s*,\s*/)) if (name && !names.includes(name)) names.push(name);
  }
  return names;
};

function Session({ track }: { track: SiteTrack }) {
  const title = clean(track.title);
  const abstract = clean(track.abstract);
  const speakers = clean(track.speakersName);
  return (
    <li className="relative">
      <span className="absolute -left-[2.6rem] top-1.5 size-4 rounded-full border-4 border-white bg-basil ring-2 ring-cyan-200" aria-hidden="true" />
      <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">{formatTimeRange(track.startTime, track.endTime)}</p>
      <h4 className={`mt-1 leading-snug ${LOGISTICS.test(title) ? 'text-lg font-semibold text-muted' : 'text-xl font-bold text-navy'}`}>{title}</h4>
      {speakers && <p className="mt-1 inline-flex items-center gap-2 font-semibold text-muted"><Icon name="mic" className="size-4" />{speakers}</p>}
      {abstract && abstract.length <= 200 && <p className="mt-2 max-w-[65ch] text-base leading-relaxed text-navy/85">{abstract}</p>}
      {abstract.length > 200 && (
        <Disclosure className="mt-1 max-w-[65ch]">
          {({ isExpanded }) => (
            <>
              <Button slot="trigger" className={triggerLink}>{isExpanded ? "Nascondi l'abstract" : "Leggi l'abstract"}</Button>
              <DisclosurePanel><p className="mt-1 text-base leading-relaxed text-navy/85">{abstract}</p></DisclosurePanel>
            </>
          )}
        </Disclosure>
      )}
    </li>
  );
}

/** Timeline of the sessions of an event. */
export default function EventProgramme({ workshop }: { workshop: SiteWorkshop }) {
  const tracks = sortedTracks(workshop);
  if (tracks.length === 0) return <p className="mt-6 text-lg text-muted">Il programma non è ancora stato pubblicato.</p>;
  return (
    <ol className="relative mt-8 space-y-6 border-l-2 border-cyan-200 pl-8">
      {tracks.map(track => <Session key={track.workshopTrackId} track={track} />)}
    </ol>
  );
}
