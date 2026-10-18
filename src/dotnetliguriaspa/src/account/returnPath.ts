/** Keep SPA navigation local even for malformed or network-path URL input. */
export function accountReturnPath({ pathname, search, hash }: { pathname: string; search: string; hash: string }) {
  return pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('\\')
    ? pathname + search + hash : '/';
}
