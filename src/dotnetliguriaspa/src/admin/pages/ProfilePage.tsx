import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, Form } from 'react-aria-components';
import { useOidcUser } from '@axa-fr/react-oidc';
import { AdminIcon } from '../icons';
import { PageHeader, Panel, TextInput, btn, focusRing, linkFocus } from '../ui';
import { getOidcPublicSettings } from '../../config/oidcConfig';

// The old form posted these fields as Keycloak account attributes (d_city, d_prov, d_factory_*, d_social_*,
// d_consent, d_privacy_consent) to an unrelated server. Saving them needs a real backend/Keycloak integration:
// until then the form is complete but marked "da completare" and does not send anything.
type Extra = {
  city: string; prov: string;
  factory: string; factoryRole: string; factoryCity: string; factoryProv: string;
  twitter: string; linkedin: string; github: string;
  consentData: boolean; consentPrivacy: boolean;
};
const EMPTY: Extra = { city: '', prov: '', factory: '', factoryRole: '', factoryCity: '', factoryProv: '', twitter: '', linkedin: '', github: '', consentData: false, consentPrivacy: false };

const url = (value: string) => (!value.trim() || /^https?:\/\/\S+$/i.test(value.trim()) ? null : 'Inserisci un indirizzo completo che inizi con https://');

function Consent({ isSelected, onChange, children }: { isSelected: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Checkbox isSelected={isSelected} onChange={onChange} className={`group flex cursor-pointer items-start gap-3 rounded-xl py-1.5 ${focusRing}`}>
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 border-navy bg-white text-white group-data-[selected]:bg-navy">
        <AdminIcon name="check" className="size-4 opacity-0 group-data-[selected]:opacity-100" />
      </span>
      <span>{children}</span>
    </Checkbox>
  );
}

export default function ProfilePage() {
  const { oidcUser } = useOidcUser();
  const [extra, setExtra] = useState<Extra>(EMPTY);
  const set = <K extends keyof Extra>(key: K) => (value: Extra[K]) => setExtra(e => ({ ...e, [key]: value }));
  const account = `${getOidcPublicSettings().authority.replace(/\/+$/, '')}/account`;
  const given = String(oidcUser?.given_name ?? '');
  const family = String(oidcUser?.family_name ?? '');
  const email = String(oidcUser?.email ?? '');

  return (
    <>
      <PageHeader title="Profilo" description="I tuoi dati nell'area riservata di DotNetLiguria." />

      <div role="status" className="mt-6 flex flex-wrap items-start gap-3 rounded-2xl bg-[#fff4e5] p-5 text-[#8a4b00]">
        <AdminIcon name="todo" className="mt-0.5 size-6" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Salvataggio da completare</p>
          <p>Il modulo non invia ancora i dati: manca il collegamento con gli attributi dell'account Keycloak. Nome, email e password li cambi già dalla console del tuo account.</p>
        </div>
        <a href={account} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} border-[#8a4b00] text-[#8a4b00] hover:bg-[#8a4b00] hover:text-white`}>
          <AdminIcon name="external" />Apri il tuo account<span className="sr-only"> (si apre in una nuova scheda)</span>
        </a>
      </div>

      <Form className="mt-6 grid items-start gap-5 xl:grid-cols-2" onSubmit={e => e.preventDefault()}>
        <Panel labelledBy="p-you" className="space-y-4 p-5 sm:p-6">
          <h2 id="p-you" className="text-lg font-bold">I tuoi dati</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Nome" value={given} isReadOnly description="Dall'account" />
            <TextInput label="Cognome" value={family} isReadOnly description="Dall'account" />
          </div>
          <TextInput label="Email" value={email} isReadOnly type="email" description="Si cambia dalla console dell'account." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Città" value={extra.city} onChange={set('city')} />
            <TextInput label="Provincia" value={extra.prov} onChange={set('prov')} />
          </div>
        </Panel>

        <Panel labelledBy="p-work" className="space-y-4 p-5 sm:p-6">
          <h2 id="p-work" className="text-lg font-bold">Azienda</h2>
          <p className="text-sm text-muted">Resta nell'area riservata: il sito non mostra mai l'azienda dei partecipanti.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Azienda" value={extra.factory} onChange={set('factory')} />
            <TextInput label="Ruolo" value={extra.factoryRole} onChange={set('factoryRole')} />
            <TextInput label="Città" value={extra.factoryCity} onChange={set('factoryCity')} />
            <TextInput label="Provincia" value={extra.factoryProv} onChange={set('factoryProv')} />
          </div>
        </Panel>

        <Panel labelledBy="p-social" className="space-y-4 p-5 sm:p-6">
          <h2 id="p-social" className="text-lg font-bold">Social</h2>
          <TextInput label="X / Twitter" type="url" value={extra.twitter} onChange={set('twitter')} placeholder="https://x.com/…" validate={url} />
          <TextInput label="LinkedIn" type="url" value={extra.linkedin} onChange={set('linkedin')} placeholder="https://www.linkedin.com/in/…" validate={url} />
          <TextInput label="GitHub" type="url" value={extra.github} onChange={set('github')} placeholder="https://github.com/…" validate={url} />
        </Panel>

        <Panel labelledBy="p-consent" className="space-y-3 p-5 sm:p-6">
          <h2 id="p-consent" className="text-lg font-bold">Consensi</h2>
          <Consent isSelected={extra.consentData} onChange={set('consentData')}>Acconsento al trattamento dei miei dati per le attività della community.</Consent>
          <Consent isSelected={extra.consentPrivacy} onChange={set('consentPrivacy')}>
            Ho letto l'<Link to="/privacy" target="_blank" className={`font-bold text-cyan-700 underline ${linkFocus}`}>informativa sulla privacy<span className="sr-only"> (si apre in una nuova scheda)</span></Link>.
          </Consent>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-3 xl:col-span-2">
          <span className="text-sm text-muted">Il salvataggio arriverà con il collegamento all'account.</span>
          <Button type="submit" isDisabled className={btn.primary}>Salva (da completare)</Button>
        </div>
      </Form>
    </>
  );
}
