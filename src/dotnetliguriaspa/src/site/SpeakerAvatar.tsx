import React, { useMemo, useState } from 'react';
import { contentUrl } from './siteApi';

const slug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Candidate photo URLs for a speaker. Speaker records still carry legacy /Uploads paths that are no longer
 * served, while the photos live in /Contents/speakers or /Contents/profile named after the speaker:
 * try the record first, then those files, then initials.
 */
function candidates(name: string, profileImageUrl?: string | null) {
  const list: string[] = [];
  if (profileImageUrl && !/^\/?uploads\//i.test(profileImageUrl)) {
    const url = /^https?:\/\//.test(profileImageUrl) ? profileImageUrl : contentUrl(profileImageUrl);
    if (url) list.push(url);
  }
  const base = slug(name);
  if (base) {
    for (const folder of ['speakers', 'profile']) {
      for (const ext of ['jpg', 'png']) list.push(contentUrl(`${folder}/${base}.${ext}`)!);
    }
  }
  return list;
}

/** Round speaker portrait in the site's duotone style, with initials as fallback. */
export default function SpeakerAvatar({ name, profileImageUrl, size = 'size-20' }: { name: string; profileImageUrl?: string | null; size?: string }) {
  const sources = useMemo(() => candidates(name, profileImageUrl), [name, profileImageUrl]);
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
