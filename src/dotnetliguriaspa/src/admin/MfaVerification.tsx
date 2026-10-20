import React, { useId } from 'react';
import { Button } from 'react-aria-components';
import { useOidc } from '@axa-fr/react-oidc';
import { useLocation } from 'react-router-dom';
import { accountReturnPath } from '../account/returnPath';
import { mfaStepUpExtras } from '../account/mfaStepUp';
import { useMfaWindow } from '../account/useMfaWindow';
import { Panel, btn } from './ui';

export default function MfaVerification({ mfa, busy = false, title = 'Verifica MFA' }: {
  mfa: ReturnType<typeof useMfaWindow>; busy?: boolean; title?: string;
}) {
  const id = useId();
  const { login } = useOidc();
  const location = useLocation();
  const minutes = Math.floor(mfa.remaining / 60);
  const seconds = String(mfa.remaining % 60).padStart(2, '0');
  const status = mfa.active
    ? `MFA attiva: verifica valida per altri ${minutes}:${seconds} minuti.`
    : mfa.strong
      ? 'MFA scaduta: la verifica risale a più di 5 minuti fa. Ripetila per continuare.'
      : `MFA non attiva per questo accesso (livello: ${mfa.level || 'non indicato'}). Esegui la verifica per le operazioni che la richiedono.`;

  return <Panel labelledBy={id} className="mt-6 space-y-3 p-5">
    <h2 id={id} className="text-lg font-bold">{title}</h2>
    <p role="note" className={mfa.active ? 'font-semibold text-emerald-800' : 'font-semibold text-red-800'}>{status}</p>
    <p>Le operazioni sensibili richiedono una verifica MFA (codice OTP o chiave di sicurezza) effettuata negli ultimi 5 minuti.</p>
    <Button className={mfa.active ? btn.secondary : btn.primary} isDisabled={busy}
      onPress={() => void login(accountReturnPath(location), mfaStepUpExtras())}>
      Verifica MFA
    </Button>
  </Panel>;
}
