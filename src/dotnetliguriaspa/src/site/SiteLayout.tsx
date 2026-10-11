import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import CookieNotice from './legal/CookieNotice';

/** Shell of every public page: skip link, header, main landmark, footer and the informational cookie notice. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site flex flex-col">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-navy focus:px-5 focus:py-3 focus:font-bold focus:text-white"
      >
        Salta al contenuto
      </a>
      <SiteHeader />
      <main id="contenuto" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <CookieNotice />
    </div>
  );
}
