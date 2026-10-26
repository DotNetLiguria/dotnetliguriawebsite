import React, { useState } from 'react';
import { profilePhotoUrl } from './speakerPhotos';

/** Round speaker portrait in the site's duotone style, with initials as fallback. */
export default function SpeakerAvatar({ name, profileImageUrl, size = 'size-20' }: { name: string; profileImageUrl?: string | null; photoFallbackDisabled?: boolean; size?: string }) {
  const source = profilePhotoUrl(profileImageUrl);
  return <Portrait key={source ?? ''} name={name} source={source} size={size} />;
}

function Portrait({ name, source, size }: { name: string; source: string | null; size: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  if (!source || failed) {
    return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-cyan-50 text-xl font-bold text-cyan-700`} aria-hidden="true">{initials}</span>;
  }
  return (
    <span className={`relative isolate block ${size} shrink-0 overflow-hidden rounded-full bg-cyan-50 after:pointer-events-none after:absolute after:inset-0 after:bg-navy after:opacity-55 after:mix-blend-screen after:content-['']`}>
      <img
        src={source}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover object-[50%_30%] mix-blend-multiply brightness-105 contrast-90 grayscale"
      />
    </span>
  );
}
