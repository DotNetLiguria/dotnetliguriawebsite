import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useOidc, useOidcIdToken } from '@axa-fr/react-oidc';
import { PageHeader, Panel, TextInput, btn, focusRing } from '../ui';
import { getOidcPublicSettings } from '../../config/oidcConfig';
import { clearPrivateBrowserState } from '../../questionnaire/drafts';
import { PersonalData, PersonalIdentity, useAccountRequest } from '../../account/accountApi';
import { useAccountResource } from '../../account/useAccountResource';
import { accountReturnPath } from '../../account/returnPath';
import { mfaStepUpExtras } from '../../account/mfaStepUp';
import { useAccountCapabilities } from '../../account/AccountCapabilities';
import PhotoEditor from '../../account/PhotoEditor';

const tabCls = `-mb-px inline-flex min-h-11 cursor-pointer items-center border-b-[3px] border-transparent px-4 font-bold text-muted transition-colors data-[hovered]:text-navy data-[selected]:border-navy data-[selected]:text-navy ${focusRing}`;
const date = (value: string | null) => value && !Number.isNaN(Date.parse(value))
  ? new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Non disponibile';

function ResourceStatus({ name, loading, error, reload }: { name: string; loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <p role="status">Caricamento {name}…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">
      <p>{name}: {error}</p><Button className={btn.secondary} onPress={reload}>Riprova {name}</Button>
    </div>}</>;
}

export default function ProfilePage() {
  const { logout } = useOidc();
  const { clear } = useAccountCapabilities();
  const [erased, setErased] = useState<'completed' | 'awaiting_manual_identity_removal' | null>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
  if (erased) return <section className="space-y-4">
    <h1 className="text-3xl font-bold">Richiesta di cancellazione</h1>
    <p role="status">{erased === 'completed' ? 'Cancellazione completata.'
      : 'Richiesta accettata. I dati del sito sono stati rimossi e l’account è disabilitato. La rimozione dell’identità nell’Identity Provider richiede un intervento amministrativo: la cancellazione non è ancora completata.'}</p>
    {logoutFailed && <p role="alert">La chiusura della sessione non è riuscita: chiudi la scheda.</p>}
    <Link className={btn.secondary} to="/">Torna al sito</Link>
  </section>;
  return <PersonalContent onErased={status => {
    clearPrivateBrowserState();
    clear();
    setErased(status);
    void logout('/').catch(() => setLogoutFailed(true));
  }} />;
}

function PersonalContent({ onErased }: { onErased: (status: 'completed' | 'awaiting_manual_identity_removal') => void }) {
  const { login } = useOidc();
  const { idTokenPayload } = useOidcIdToken();
  const signInLevel = typeof idTokenPayload?.acr === 'string' ? idTokenPayload.acr : '';
  const signedInWithMfa = signInLevel === 'mfa' || signInLevel === 'hwk';
  const location = useLocation();
  const request = useAccountRequest();
  const profile = useAccountResource<PersonalIdentity>('privacy/profile');
  const personal = useAccountResource<PersonalData>('privacy/data?offset=0');
  const privacy = useAccountResource<{ status: string }>('privacy/status');
  const [recordOffset, setRecordOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [profileDraft, setProfileDraft] = useState<{ firstName: string; lastName: string } | null>(null);
  const account = `${getOidcPublicSettings().authority.replace(/\/+$/, '')}/account`;
  const reloadPersonal = () => { personal.setData(null); setRecordOffset(0); personal.reload(); };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operazione non completata. Richiedi assistenza.'); }
    finally { setBusy(false); }
  };
  const saveProfile = () => run(async () => {
    if (!profileDraft) throw new Error('Nessuna modifica da salvare.');
    const response = await request('privacy/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileDraft),
    });
    const saved = await response.json() as PersonalIdentity;
    profile.setData(saved);
    setProfileDraft(null);
    reloadPersonal();
    setMessage(saved.emailVerified ? 'Dati personali salvati nell’Identity Provider.'
      : 'Dati personali salvati nell’Identity Provider. L’email non è verificata: apri la console dell’Identity Provider per completare la verifica.');
  });
  const exportData = () => run(async () => {
    const response = await request('privacy/export');
    const url = URL.createObjectURL(await response.blob());
    try {
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'dotnetliguria-dati-personali.json'; anchor.click();
    } finally { URL.revokeObjectURL(url); }
    setMessage('Esportazione scaricata: contiene dati personali. Conservala e cancellala in modo sicuro.');
  });
  const erase = () => run(async () => {
    const response = await request('privacy/erase', { method: 'POST', headers: { 'X-Confirm-Erasure': 'erase-my-account' } });
    const result = await response.json() as { status: string };
    if (response.status === 200 && result.status === 'completed') onErased('completed');
    else if (response.status === 202 && result.status === 'awaiting_manual_identity_removal') onErased('awaiting_manual_identity_removal');
    else throw new Error('Esito della cancellazione non confermato. Richiedi assistenza.');
  });
  const identity = profile.data;
  return <>
    <PageHeader title="Area personale" description="Account, dati condivisi, consensi e diritti privacy." />
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-cyan-50 p-4">{message}</p>}
    <Tabs defaultSelectedKey="account" className="mt-6">
      <TabList aria-label="Sezioni dell'area personale" className="flex gap-1 overflow-x-auto border-b border-line">
        <Tab id="account" className={tabCls}>Account</Tab>
        <Tab id="data" className={tabCls}>Dati condivisi</Tab>
        <Tab id="consents" className={tabCls}>Consensi</Tab>
        <Tab id="privacy" className={tabCls}>Privacy</Tab>
      </TabList>
      <TabPanel id="account" className="mt-5 outline-none">
      <Panel labelledBy="profile-account" className="space-y-4 p-6">
        <h2 id="profile-account" className="text-lg font-bold">Account Identity Provider</h2>
        <p>Nome e cognome sono salvati direttamente nell’Identity Provider. Non ne conserviamo una copia nel sito.
          Il cambio email, la verifica dell’email, password e MFA si gestiscono nella console dell’Identity Provider.</p>
        <ResourceStatus name="dati personali" {...profile} reload={() => { setProfileDraft(null); profile.reload(); }} />
        {identity && <>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); void saveProfile(); }}>
            <TextInput label="Nome" value={profileDraft?.firstName ?? identity.firstName ?? ''}
              maxLength={255} isReadOnly={!profileDraft} isDisabled={busy || profile.loading}
              onChange={firstName => setProfileDraft(current => current && { ...current, firstName })} />
            <TextInput label="Cognome" value={profileDraft?.lastName ?? identity.lastName ?? ''}
              maxLength={255} isReadOnly={!profileDraft} isDisabled={busy || profile.loading}
              onChange={lastName => setProfileDraft(current => current && { ...current, lastName })} />
            <TextInput label="Email" type="email" value={identity.email ?? ''} isReadOnly
              description="Per cambiare email usa Modifica account e sicurezza e completa la verifica richiesta nell’Identity Provider." />
            {profileDraft ? <div className="flex flex-wrap gap-3">
              <Button type="submit" className={btn.primary} isDisabled={busy || profile.loading || !!profile.error}>Salva dati personali</Button>
              <Button type="button" className={btn.secondary} isDisabled={busy}
                onPress={() => setProfileDraft(null)}>Annulla modifiche</Button>
            </div> : <Button type="button" className={btn.primary} isDisabled={busy || profile.loading || !!profile.error}
              onPress={() => { setError(''); setMessage(''); setProfileDraft({
                firstName: identity.firstName ?? '', lastName: identity.lastName ?? '',
              }); }}>Modifica dati personali</Button>}
          </form>
          <p>Email {identity.emailVerified ? 'verificata' : 'non verificata'}.</p>
        </>}
        <Button className={btn.secondary} isDisabled={busy || profile.loading} onPress={() => {
          setProfileDraft(null); profile.reload();
        }}>Aggiorna dati personali</Button>
        <a href={account} target="_blank" rel="noopener noreferrer" className={btn.secondary}>Modifica account e sicurezza (nuova scheda)</a>
      </Panel>
      <div className="mt-5"><PhotoEditor scope="account" onChanged={reloadPersonal} /></div>
      <Panel labelledBy="profile-mfa" className="mt-5 space-y-4 p-6">
        <h2 id="profile-mfa" className="text-lg font-bold">Secondo fattore di accesso (MFA)</h2>
        <p>Alcune operazioni protette richiedono una verifica MFA recente. Configura un’app di autenticazione
          (codice OTP) oppure una chiave di sicurezza: l’Identity Provider ti guiderà nella registrazione e poi ti
          riporterà a questa pagina.</p>
        <p role="note">{signedInWithMfa ? 'L’accesso corrente include una verifica MFA.'
          : `L’accesso corrente non include una verifica MFA (livello: ${signInLevel || 'non indicato'}). Dopo aver configurato il secondo fattore usa “Verifica MFA ora”: l’accesso normale non lo richiede.`}</p>
        <div className="flex flex-wrap gap-3">
          <Button className={btn.primary} isDisabled={busy}
            onPress={() => void login(accountReturnPath(location), mfaStepUpExtras())}>Verifica MFA ora</Button>
          <Button className={btn.secondary} isDisabled={busy}
            onPress={() => void login(accountReturnPath(location), { kc_action: 'CONFIGURE_TOTP' })}>Configura app di autenticazione (OTP)</Button>
          <Button className={btn.secondary} isDisabled={busy}
            onPress={() => void login(accountReturnPath(location), { kc_action: 'webauthn-register' })}>Registra chiave di sicurezza</Button>
        </div>
      </Panel>
      </TabPanel>
      <TabPanel id="data" className="mt-5 outline-none">
      <Panel labelledBy="profile-data" className="space-y-4 p-6">
        <h2 id="profile-data" className="text-lg font-bold">Dati condivisi con il sito</h2>
        <ResourceStatus name="dati condivisi" {...personal} reload={reloadPersonal} />
        <p>Mostriamo solo i dati attribuibili al tuo account e le evidenze di consenso effettivamente disponibili.</p>
        {personal.data?.warning && <p role="note">{personal.data.warning}</p>}
        {personal.data?.records.length === 0 && <p>Nessun record attribuibile disponibile.</p>}
        <ul className="space-y-3">{personal.data?.records.map(record => <li key={`${record.kind}:${record.id}`} className="rounded-xl border border-line p-4">
          <h3 className="font-bold">{record.title ?? 'Senza titolo'}</h3>
          <p>Tipo: {record.kind} · Data: {date(record.submittedAt)}</p>
          <p>Consenso questionario: {record.consentGiven === null ? 'non disponibile' : record.consentGiven ? 'prestato' : 'non prestato'}.
            Versione: {record.questionnaireVersion ?? 'non disponibile'}.</p>
        </li>)}</ul>
        {personal.data?.hasMore && <Button className={btn.secondary} isDisabled={busy || personal.loading} onPress={() => void run(async () => {
          const next = await (await request(`privacy/data?offset=${recordOffset + 50}`)).json() as PersonalData;
          personal.setData(current => current ? { ...next, records: [...current.records, ...next.records] } : next);
          setRecordOffset(value => value + 50);
        })}>Carica altri dati</Button>}
      </Panel>
      </TabPanel>
      <TabPanel id="consents" className="mt-5 outline-none">
      <Panel labelledBy="profile-consents" className="space-y-4 p-6">
        <h2 id="profile-consents" className="text-lg font-bold">Lista dei consensi</h2>
        <ul className="space-y-3">
          <li className="rounded-xl border border-line p-4">
            <label className="flex min-h-11 items-center gap-3 font-bold">
              <input className="size-6" type="checkbox" checked disabled />
              Email per nuovi eventi
            </label>
          </li>
        </ul>
        <p>
          Questo consenso è il requisito minimo per fare parte della community e non può essere revocato.
          Se non desideri ricevere queste email, puoi cancellarti definitivamente dalla community nella sezione Privacy.
        </p>
        <Link className="inline-flex min-h-11 items-center font-bold underline" to="/privacy">Leggi l'informativa sulla privacy</Link>
      </Panel>
      </TabPanel>
      <TabPanel id="privacy" className="mt-5 outline-none">
      <Panel labelledBy="profile-privacy" className="space-y-4 p-6">
        <h2 id="profile-privacy" className="text-lg font-bold">Esportazione e cancellazione</h2>
        <ResourceStatus name="stato privacy" {...privacy} />
        {privacy.data && <p>{privacy.data.status === 'no_pending_request' ? 'Nessuna richiesta pendente.'
          : `Richiesta non conclusa (${privacy.data.status}). Rivolgiti a un amministratore per il recupero.`}</p>}
        <p>L'esportazione è personale e può contenere risposte sensibili. I dati legacy non attribuibili
          richiedono una verifica separata: un export non dimostra l'assenza di altri dati.</p>
        <Button className={btn.secondary} isDisabled={busy} onPress={() => void exportData()}>Esporta i miei dati</Button>
        <p>La cancellazione è irreversibile: elimina il profilo nell’Identity Provider, le tue risposte e i questionari
          che hai creato, comprese tutte le risposte di altre persone a quei questionari.
          Le copie di sicurezza interessate vengono eliminate. Dati non attribuibili, configurazioni
          non sicure o copie esterne non verificate bloccano il completamento. Se serve una rimozione
          manuale dell’identità, la richiesta resta pendente fino alla verifica amministrativa.</p>
        <div role="note" aria-label="Conferma finale della cancellazione" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-red-700 font-bold">!</span>
          <div className="space-y-1">
            <p className="font-bold">Conferma finale: cancellazione di tutti i tuoi dati</p>
            <p>Verranno eliminati definitivamente il tuo profilo, i tuoi dati e i questionari che hai creato,
              incluse tutte le risposte inviate da altre persone. Questa operazione non può essere annullata.</p>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3"><input className="size-6" type="checkbox" checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)} />
          Confermo di voler cancellare tutti i miei dati, il profilo e i questionari creati con tutte le risposte.</label>
        <TextInput label="Scrivi ELIMINA per confermare" value={confirmation} onChange={setConfirmation} />
        <Button className={btn.danger} isDisabled={busy || !acknowledged || confirmation !== 'ELIMINA'}
          onPress={() => void erase()}>Cancella definitivamente il mio account</Button>
      </Panel>
      </TabPanel>
    </Tabs>
  </>;
}
