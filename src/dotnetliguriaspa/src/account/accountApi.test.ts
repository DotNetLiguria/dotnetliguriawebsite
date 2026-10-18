import { renderHook } from '@testing-library/react';
import { jsonResponse, mockApi } from '../test-utils';
import { useAccountRequest } from './accountApi';

test.each([
  ['identity_disable_not_verified', 'disabilitazione'],
  ['consent_history_recovery_limit', 'recupero amministrativo'],
  ['consent_evidence_invalid', 'evidenze di consenso'],
  ['consent_write_not_verified', 'non è stata verificata'],
  ['invalid_page_offset', 'pagina richiesta'],
  ['export_limit_exceeded', 'limite dell’esportazione'],
  ['identity_must_already_be_deleted', 'esiste ancora in Keycloak'],
])('explains operational code %s without claiming success', async (code, text) => {
  mockApi({ 'privacy/test': () => jsonResponse({ code }, 409) });
  const { result } = renderHook(useAccountRequest);
  await expect(result.current('privacy/test')).rejects.toThrow(text);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/privacy/test'), expect.objectContaining({ cache: 'no-store' }));
});
