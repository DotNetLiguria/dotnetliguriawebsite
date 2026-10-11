import React from 'react';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import { SiteWorkshop } from '../siteApi';
import { formatTimeRange } from '../format';
import { Icon } from '../icons';
import { ProgrammeEntry, programme } from './programme';

export const triggerLink = 'inline-flex min-h-11 cursor-pointer items-center gap-1 font-bold text-cyan-700 underline decoration-2 underline-offset-4 outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700';

function Session({ entry }: { entry: ProgrammeEntry }) {
  const { title, abstract, details, speakers, logistics } = entry;
  return (
    <li className="relative">
      <span className="absolute -left-[2.6rem] top-1.5 size-4 rounded-full border-4 border-white bg-basil ring-2 ring-cyan-200" aria-hidden="true" />
      <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">
        {formatTimeRange(entry.startTime, entry.endTime)}
        {details.length > 0 && <span className="font-semibold normal-case tracking-normal text-muted"> · {details.join(' · ')}</span>}
      </p>
      <h4 className={`mt-1 leading-snug ${logistics ? 'text-lg font-semibold text-muted' : 'text-xl font-bold text-navy'}`}>{title}</h4>
      {speakers.length > 0 && (
        <p className="mt-1 inline-flex items-center gap-2 font-semibold text-muted">
          <Icon name="mic" className="size-4" />{speakers.map(speaker => speaker.name).join(', ')}
        </p>
      )}
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
  const entries = programme(workshop);
  if (entries.length === 0) return <p className="mt-6 text-lg text-muted">Il programma non è ancora stato pubblicato.</p>;
  return (
    <ol className="relative mt-8 space-y-6 border-l-2 border-cyan-200 pl-8">
      {entries.map(entry => <Session key={entry.id} entry={entry} />)}
    </ol>
  );
}
