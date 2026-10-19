// Facts shared by the legal pages and the footer. Anything not listed here is not known yet and
// appears on the pages as a "Da completare" placeholder instead of being invented.

/** Date shown as "Ultimo aggiornamento" on the three legal pages (yyyy-mm-dd). */
export const LEGAL_UPDATED = '2026-10-19';

/** Hosting provider, also operator of the Keycloak sign-in service used by the admin area. */
export const HOSTING = {
  name: 'Vevy Europe S.p.A.',
  address: 'via Semeria, 16A - 16131 Genova - Italia',
  vat: 'IT00269300109',
};

export const HOSTING_DETAILS = `${HOSTING.name} (${HOSTING.address} - P.IVA ${HOSTING.vat})`;

/** The legal line of the footer, exactly as the owner wrote it. */
export const FOOTER_LEGAL_LINE = `©DotNetLiguria, hosted by ${HOSTING.name} via Semeria, 16A - 16131 Genova - Italia - P.IVA ${HOSTING.vat}`;

export const LEGAL_PAGES = [
  { to: '/privacy', label: 'Informativa sulla privacy' },
  { to: '/termini-di-servizio', label: 'Termini di servizio' },
  { to: '/cookie', label: 'Cookie policy' },
] as const;

/** localStorage key remembering that the cookie notice was dismissed. */
export const COOKIE_NOTICE_KEY = 'dnl-cookie-notice';
