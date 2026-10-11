import React from 'react';
import { Link } from 'react-router-dom';
// Historic logo with white lettering for the navy footer (arc and basil unchanged).
import logo from '../assets/logo/dotnet-liguria-storico-dark.png';
import logo2x from '../assets/logo/dotnet-liguria-storico-dark-2x.png';
import { FOOTER_LEGAL_LINE } from './legal/legalFacts';

// 44px targets on phones, tighter on desktop (still above the 24px minimum of WCAG 2.5.8).
const footerLink = 'inline-flex min-h-11 items-center text-lg font-semibold text-white hover:underline md:min-h-9';

/** A titled group of footer links; the visible title names the navigation landmark. */
function FooterNav({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <nav aria-labelledby={id}>
      <p id={id} className="text-sm font-bold uppercase tracking-wide text-cyan-200">{title}</p>
      <ul className="mt-1 grid">{children}</ul>
    </nav>
  );
}

export default function SiteFooter() {
  return (
    <footer className="on-navy bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto]">
        <div>
          <img src={logo} srcSet={`${logo} 1x, ${logo2x} 2x`} alt="DotNetLiguria" width={241} height={105} className="h-20 w-auto" />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-cyan-50/85">
            La prima community .NET della Liguria: eventi, workshop e incontri dal 2011.
          </p>
        </div>
        <div className="grid content-start gap-8 md:grid-flow-col md:gap-16">
          <FooterNav id="footer-site" title="Il sito">
            <li><Link to="/workshops" className={footerLink}>Eventi passati</Link></li>
            <li><Link to="/#team" className={footerLink}>Il team</Link></li>
          </FooterNav>
          <FooterNav id="footer-legal" title="Informazioni legali">
            <li><Link to="/privacy" className={footerLink}>Privacy</Link></li>
            <li><Link to="/termini-di-servizio" className={footerLink}>Termini di servizio</Link></li>
            <li><Link to="/cookie" className={footerLink}>Cookie</Link></li>
          </FooterNav>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-5 text-sm text-cyan-50/75 sm:px-6">
          <p>{FOOTER_LEGAL_LINE}</p>
          <p>I contenuti dei talk appartengono ai rispettivi autori.</p>
        </div>
      </div>
    </footer>
  );
}
