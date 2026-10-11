import React from 'react';
import { Link } from 'react-router-dom';
// Historic logo with white lettering for the navy footer (arc and basil unchanged).
import logo from '../assets/logo/dotnet-liguria-storico-dark.png';
import logo2x from '../assets/logo/dotnet-liguria-storico-dark-2x.png';
import { FOOTER_LEGAL_LINE } from './legal/legalFacts';

const footerLink = 'inline-flex min-h-11 items-center font-semibold text-white hover:underline';

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
        <ul className="grid content-start gap-1 text-lg">
          <li><Link to="/workshops" className={footerLink}>Eventi passati</Link></li>
          <li><Link to="/#team" className={footerLink}>Il team</Link></li>
          <li><Link to="/privacy" className={footerLink}>Privacy</Link></li>
          <li><Link to="/termini-di-servizio" className={footerLink}>Termini di servizio</Link></li>
          <li><Link to="/cookie" className={footerLink}>Cookie</Link></li>
        </ul>
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
