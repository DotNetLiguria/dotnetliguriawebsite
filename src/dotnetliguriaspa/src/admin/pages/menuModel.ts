import { clean } from '../adminApi';
import TopMenuElementModel from '../../models/TopMenuElementModel';
import { isWebUrl } from './boardModel';

/** A site menu entry as serialized by DotNetLiguriaCore; the update replaces the whole record. */
export type AdminMenuItem = TopMenuElementModel & { [key: string]: unknown };

/** The id the API expects (and ignores) when a new entry is created. */
export const NEW_MENU_ITEM_ID = '00000000-0000-0000-0000-000000000000';

/**
 * A page of this site ("/workshops", "/#team") or a full http(s) address. Site paths reject "//" and any
 * backslash: browsers read "/\evil.example" as "//evil.example", a link to another site.
 */
export const isMenuUrl = (value?: string | null) => {
  const url = clean(value);
  return /^\/(?![/\\])[^\s\\]*$/.test(url) || isWebUrl(url);
};

export const menuUrlError = (value: string) => {
  if (!clean(value)) return "L'indirizzo è obbligatorio.";
  return isMenuUrl(value) ? null : 'Indica una pagina del sito, come /workshops o /#team, oppure un indirizzo che inizi con https://.';
};
