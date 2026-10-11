import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-aria-components';
import { COOKIE_NOTICE_KEY } from './legalFacts';

/**
 * Informational notice, not a consent dialog: the site only uses technical storage, so there is nothing to
 * accept or refuse. It never blocks the page, traps focus or hides content (it sits in the page flow after the
 * footer and sticks to the bottom of the viewport while there is more to read).
 */

const DISMISSED = 'dismissed';
// Keeps the dismissal for the rest of the visit when localStorage is unavailable (private mode, blocked data).
let dismissedInMemory = false;

function wasDismissed() {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) === DISMISSED;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  dismissedInMemory = true;
  try {
    localStorage.setItem(COOKIE_NOTICE_KEY, DISMISSED);
  } catch {
    // Storage unavailable: the notice stays closed for this visit only.
  }
}

/** Forgets the dismissal, so that the notice shows again (used by tests). */
export function resetCookieNotice() {
  dismissedInMemory = false;
  try {
    localStorage.removeItem(COOKIE_NOTICE_KEY);
  } catch {
    // Nothing to forget.
  }
}

const focusRing = 'outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-cyan-700';

export default function CookieNotice() {
  const [visible, setVisible] = useState(() => !wasDismissed());
  const frame = useRef<HTMLDivElement>(null);

  // While the notice is shown, tell the rest of the page how much room it takes: focused elements scroll
  // clear of it (WCAG 2.4.11) and the floating "back to top" button stacks above it on phones.
  useEffect(() => {
    if (!visible) return undefined;
    const root = document.documentElement;
    const publish = () => {
      const height = frame.current?.offsetHeight ?? 0;
      root.style.setProperty('--site-notice-height', `${height}px`);
      root.style.scrollPaddingBottom = `${height + 12}px`;
    };
    publish();
    window.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      root.style.removeProperty('--site-notice-height');
      root.style.removeProperty('scroll-padding-bottom');
    };
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    rememberDismissal();
    setVisible(false);
    // The button disappears with the notice: hand focus to the page instead of dropping it.
    document.getElementById('contenuto')?.focus({ preventScroll: true });
  };

  return (
    <div ref={frame} className="pointer-events-none sticky bottom-0 z-40 px-3 pb-3 print:hidden">
      <section
        aria-label="Informativa sui cookie"
        className="pointer-events-auto rounded-2xl border border-line bg-white p-4 text-navy shadow-lift sm:max-w-md sm:p-5"
      >
        <p className="text-base leading-snug">
          Questo sito usa solo cookie tecnici necessari al funzionamento: nessun tracciamento.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-x-6">
          <Link to="/cookie" className="inline-flex min-h-11 items-center font-bold text-cyan-700 underline decoration-2 underline-offset-4 hover:text-navy">
            Cookie policy
          </Link>
          <Button
            onPress={dismiss}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full bg-navy px-5 font-bold text-white transition data-[hovered]:bg-navy-950 ${focusRing}`}
          >
            Ho capito
          </Button>
        </div>
      </section>
    </div>
  );
}
