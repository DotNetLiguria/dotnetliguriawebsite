import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo/dotnet-liguria-compatto-dark.svg';

export default function SiteFooter() {
  const todo = <span className="rounded-full border border-dashed border-cyan-200/60 px-2 text-sm font-bold">da completare</span>;
  return (
    <footer className="on-navy bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto]">
        <div>
          <img src={logo} alt="DotNetLiguria" width={1634} height={700} className="h-20 w-auto" />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-cyan-50/85">
            La prima community .NET della Liguria: eventi, workshop e incontri dal 2011.
          </p>
        </div>
        <ul className="grid content-start gap-1 text-lg">
          <li><Link to="/workshops" className="inline-flex min-h-11 items-center font-semibold text-white hover:underline">Eventi passati</Link></li>
          <li><Link to="/#team" className="inline-flex min-h-11 items-center font-semibold text-white hover:underline">Il team</Link></li>
          <li className="inline-flex min-h-11 items-center gap-2 text-cyan-50/85">Privacy {todo}</li>
          <li className="inline-flex min-h-11 items-center gap-2 text-cyan-50/85">Termini di servizio {todo}</li>
        </ul>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-cyan-50/75 sm:px-6">
          © 2011–{new Date().getFullYear()} DotNetLiguria. I contenuti dei talk appartengono ai rispettivi autori.
        </p>
      </div>
    </footer>
  );
}
