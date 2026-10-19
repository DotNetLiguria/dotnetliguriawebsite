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
  ['identity_must_already_be_deleted', 'esiste ancora nell’Identity Provider'],
  ['profile_edit_forbidden', 'non consente la modifica'],
  ['profile_update_rejected', 'Identity Provider ha rifiutato'],
  ['profile_update_not_verified', 'salvataggio non è stato verificato'],
  ['profile_update_conflict', 'conflitto'],
  ['profile_update_invalid', 'Controlla nome'],
  ['profile_invalid_response', 'risposta del profilo'],
  ['profile_dependency_unavailable', 'servizio profilo dell’Identity Provider'],
  ['account_erasure_in_progress', 'richiesta di cancellazione'],
  ['identity_admin_unavailable', 'servizio amministrativo dell’Identity Provider non è raggiungibile'],
  ['identity_admin_invalid_response', 'risposta del servizio amministrativo'],
])('explains operational code %s without claiming success', async (code, text) => {
  mockApi({ 'privacy/test': () => jsonResponse({ code }, 409) });
  const { result } = renderHook(useAccountRequest);
  await expect(result.current('privacy/test')).rejects.toThrow(text);
  await expect(result.current('privacy/test')).rejects.not.toThrow(/keycloak/i);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/privacy/test'), expect.objectContaining({ cache: 'no-store' }));
});
