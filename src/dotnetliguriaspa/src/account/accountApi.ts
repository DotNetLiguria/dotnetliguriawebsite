import { useCallback } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';
import { API_BASE_URL } from '../config/apiConfig';

const messages: Record<string, string> = {
  recent_mfa_required: 'È richiesta una verifica MFA recente. Verifica MFA e conferma di nuovo.',
  erasure_preflight_blocked: 'Cancellazione bloccata: dati o regole di conservazione richiedono un intervento amministrativo.',
  identity_admin_not_configured: 'Il collegamento amministrativo a Keycloak non è configurato.',
  protected_storage_not_approved: 'Le protezioni dello storage non sono ancora approvate.',
  external_copies_erasure_not_approved: 'La cancellazione delle copie esterne non è ancora approvata.',
  privacy_dependency_unavailable: 'Operazione incompleta: servizio non disponibile. Riprova o richiedi assistenza.',
  identity_must_already_be_deleted: 'L’identità esiste ancora in Keycloak: rimuovila prima di verificare il completamento.',
  identity_disable_not_verified: 'Non è stato possibile verificare la disabilitazione dell’account. La cancellazione resta bloccata: richiedi assistenza.',
  consent_history_recovery_limit: 'La cronologia richiede un recupero amministrativo. La modifica non è confermata: richiedi assistenza.',
  consent_evidence_invalid: 'Le evidenze di consenso non sono valide. Non è possibile confermare la modifica: richiedi assistenza.',
  consent_write_not_verified: 'La preferenza non è stata verificata in Keycloak. Controlla lo stato e riprova; non considerarla completata.',
  invalid_page_offset: 'La pagina richiesta non è valida. Ricarica i dati dall’inizio.',
  export_limit_exceeded: 'I dati superano il limite dell’esportazione automatica. Richiedi assistenza per accedere a tutti i tuoi dati.',
  notification_dispatch_unavailable_no_approved_provider: 'Preparazione confermata, ma nessun messaggio è stato inviato: manca un fornitore approvato.',
};

export function useAccountRequest() {
  const { fetch: authenticatedFetch } = useOidcFetch();
  return useCallback(async (path: string, init?: RequestInit) => {
    const response = await authenticatedFetch(`${API_BASE_URL.replace(/\/$/, '')}/${path}`, { ...init, cache: 'no-store' });
    if (!response.ok) {
      let code = '';
      try { code = (await response.json() as { code?: string }).code ?? ''; } catch { /* Non-JSON proxy failures. */ }
      throw new Error(response.status === 401 ? 'Accedi di nuovo al tuo account.'
        : messages[code] ?? (response.status === 403 ? 'Operazione non autorizzata.'
          : `Operazione non completata (${response.status}). Riprova o richiedi assistenza.`));
    }
    return response;
  }, [authenticatedFetch]);
}

export type PersonalData = {
  identity: { firstName: string | null; lastName: string | null; email: string | null; emailVerified: boolean } | null;
  records: { kind: string; id: string; title: string | null; submittedAt: string | null; consentGiven: boolean | null; questionnaireVersion: number | null }[];
  hasMore: boolean;
  warning: string;
};
export type ConsentData = {
  current: { purpose: string; version: string; grantedAt: string }[];
  history: { id: string; purpose: string; version: string; occurredAt: string; action: 'grant' | 'withdraw'; status: 'pending' | 'completed' | 'superseded' }[];
  hasMore: boolean;
};
export type ErasureOperation = {
  id: string; stage: string; notificationStatus: string; notificationAttempts: number; notificationError: string | null;
};
