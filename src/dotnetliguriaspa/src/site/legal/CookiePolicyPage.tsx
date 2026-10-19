import React from 'react';
import LegalPage, { ControllerDetails, LegalLink, LegalSection, LegalSubsection, LegalSummary } from './LegalPage';
import { COOKIE_NOTICE_KEY } from './legalFacts';

/** Cookie policy. Draft to be reviewed by whoever follows the association's legal matters. */

function StorageItem({ name, where, purpose, duration, setBy }: {
  name: string;
  where: string;
  purpose: string;
  duration: string;
  setBy: string;
}) {
  const row = (label: string, value: string) => (
    <div><dt className="inline font-bold text-navy">{label}: </dt><dd className="inline">{value}</dd></div>
  );
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h4 className="text-lg font-bold leading-snug text-navy"><code className="break-words font-mono text-base">{name}</code></h4>
      <dl className="mt-3 grid gap-2 text-base">
        {row('Dove', where)}
        {row('A cosa serve', purpose)}
        {row('Durata', duration)}
        {row('Chi lo imposta', setBy)}
      </dl>
    </li>
  );
}

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie policy"
      description="Quali cookie e strumenti simili usa il sito di DotNetLiguria, a cosa servono e per quanto tempo restano sul tuo dispositivo."
    >
      <LegalSummary>
        <li>Il sito non usa cookie di profilazione né di analisi e non carica cookie di terze parti.</li>
        <li>
          Visitare le pagine pubbliche non salva nulla sul tuo dispositivo. Il browser conserva dati solo se chiudi l'avviso sui
          cookie, compili un questionario o accedi con il tuo account.
        </li>
        <li>Sono tutti strumenti tecnici: per la normativa italiana non serve il tuo consenso, basta questa informativa.</li>
      </LegalSummary>

      <LegalSection id="cosa-sono" title="Cosa sono i cookie">
        <p>
          I cookie e gli strumenti simili, come localStorage e sessionStorage del browser, sono piccoli dati che un sito salva
          sul tuo dispositivo. Qui li chiamiamo «cookie» per semplicità. Il server del sito non imposta cookie ai visitatori.
        </p>
      </LegalSection>

      <LegalSection id="strumenti" title="Cosa salva il sito sul tuo dispositivo">
        <p>Questo è l'elenco completo di ciò che il sito può salvare.</p>

        <LegalSubsection title="Sulle pagine pubbliche">
          <ul className="grid gap-4">
            <StorageItem
              name={COOKIE_NOTICE_KEY}
              where="localStorage del browser"
              purpose="Ricorda che hai chiuso l'avviso sui cookie, così non te lo mostriamo di nuovo."
              duration="Finché non cancelli i dati del sito dal browser."
              setBy="DotNetLiguria, solo dopo che chiudi l'avviso."
            />
            <StorageItem
              name="questionnaire-draft:…"
              where="sessionStorage della scheda del browser"
              purpose="Conserva temporaneamente le risposte non inviate. Il testo libero può contenere dati personali. Le vecchie bozze in localStorage vengono eliminate."
              duration="30 minuti senza modifiche; cancellazione all'invio, allo scarto o alla chiusura della scheda."
              setBy="DotNetLiguria, quando apri un questionario."
            />
          </ul>
        </LegalSubsection>

        <LegalSubsection title="Accesso all'account">
          <p>
            Questi strumenti sono necessari anche per i questionari autenticati e le funzioni privacy
            dell'account, non soltanto per gli amministratori.
          </p>
          <ul className="grid gap-4">
            <StorageItem
              name="Cookie di sessione dell’Identity Provider"
              where="Cookie del dominio hello.vevy.com"
              purpose="Completare l'accesso e mantenere la sessione di accesso."
              duration="La durata della sessione di accesso, stabilita dal servizio di accesso."
              setBy="Vevy Europe S.p.A. (hello.vevy.com), non questo sito."
            />
            <StorageItem
              name="OidcServiceWorker.js"
              where="Service worker del browser"
              purpose="Gestisce i token di accesso in memoria, fuori dalla portata dello script della pagina."
              duration="Finché non esci dall'area riservata o non cancelli i dati del sito dal browser."
              setBy="DotNetLiguria, solo dopo l'accesso."
            />
            <StorageItem
              name="oidc.…"
              where="sessionStorage e localStorage del browser"
              purpose="Tengono lo stato tecnico dell'accesso, per esempio l'identificativo della scheda e i valori di sicurezza."
              duration="sessionStorage si cancella alla chiusura della scheda. Il resto, al termine dell'accesso o all'uscita."
              setBy="DotNetLiguria, solo durante l'accesso."
            />
          </ul>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="non-usiamo" title="Cosa non usiamo">
        <p>
          Sulle pagine pubbliche non usiamo strumenti di analisi o statistica, pixel o cookie pubblicitari, cookie di
          profilazione né cookie di terze parti.
        </p>
        <p>
          Il sito contiene link a siti esterni (mappe, profili pubblici, piattaforme di iscrizione agli eventi): quando li
          apri, quei siti possono usare i propri cookie. Consulta le loro informative.
        </p>
      </LegalSection>

      <LegalSection id="consenso" title="Consenso e avviso sui cookie">
        <p>
          Secondo le Linee guida cookie e altri strumenti di tracciamento del Garante per la protezione dei dati personali (10
          giugno 2021), i cookie tecnici si possono usare senza il consenso dell'utente: basta informarlo. Per questo l'avviso
          che vedi in basso nella pagina è solo informativo e non ti chiede di scegliere nulla.
        </p>
      </LegalSection>

      <LegalSection id="gestione" title="Come cancellare o bloccare i dati">
        <p>
          Puoi cancellare o bloccare i dati dei siti dalle impostazioni del browser. Il sito continua a funzionare, ma non potrà
          conservare la bozza di un questionario, l'avviso sui cookie potrebbe ripresentarsi e i membri del team non potranno
          accedere all'area riservata.
        </p>
      </LegalSection>

      <LegalSection id="contatti" title="Titolare e contatti">
        <ControllerDetails />
        <p>
          Per sapere come trattiamo i dati personali leggi l'<LegalLink to="/privacy">Informativa sulla privacy</LegalLink>; per
          le regole di uso del sito i <LegalLink to="/termini-di-servizio">Termini di servizio</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
