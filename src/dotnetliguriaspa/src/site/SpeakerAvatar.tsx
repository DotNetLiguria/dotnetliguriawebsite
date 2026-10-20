import React, { useMemo, useState } from 'react';
import { photoCandidates } from './speakerPhotos';

/** Round speaker portrait in the site's duotone style, with initials as fallback. */
export default function SpeakerAvatar({ name, profileImageUrl, photoFallbackDisabled = false, size = 'size-20' }: { name: string; profileImageUrl?: string | null; photoFallbackDisabled?: boolean; size?: string }) {
  const sources = useMemo(() => photoCandidates(name, profileImageUrl, photoFallbackDisabled), [name, profileImageUrl, photoFallbackDisabled]);
  return <Portrait key={JSON.stringify(sources)} name={name} sources={sources} size={size} />;
}

function Portrait({ name, sources, size }: { name: string; sources: string[]; size: string }) {
  const [index, setIndex] = useState(0);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  if (index >= sources.length) {
    return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-cyan-50 text-xl font-bold text-cyan-700`} aria-hidden="true">{initials}</span>;
  }
  return (
    <span className={`relative isolate block ${size} shrink-0 overflow-hidden rounded-full bg-cyan-50 after:pointer-events-none after:absolute after:inset-0 after:bg-navy after:opacity-55 after:mix-blend-screen after:content-['']`}>
      <img
        src={sources[index]}
        alt=""
        loading="lazy"
        onError={() => setIndex(i => i + 1)}
        className="size-full object-cover object-[50%_30%] mix-blend-multiply brightness-105 contrast-90 grayscale"
      />
    </span>
  );
}
