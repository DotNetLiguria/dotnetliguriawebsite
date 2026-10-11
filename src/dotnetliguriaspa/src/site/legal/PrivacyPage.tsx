import React from 'react';
import LegalPage, {
  ControllerDetails, LegalExternalLink, LegalLink, LegalSection, LegalSubsection, LegalSummary, Placeholder,
} from './LegalPage';
import { HOSTING_DETAILS } from './legalFacts';

/** Informativa sulla privacy (GDPR art. 13 e 14). Draft to be reviewed by whoever follows the association's legal matters. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa sulla privacy"
      description="Come DotNetLiguria tratta i dati personali di chi visita il sito, compila un questionario o gestisce i contenuti, ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 (GDPR)."
    >
      <LegalSummary>
        <li>Il sito non usa strumenti di analisi, pubblicità o profilazione: non ti tracciamo.</li>
        <li>Raccogliamo dati personali solo se compili un questionario che chiede nome ed email o se fai parte del team che gestisce il sito.</li>
        <li>L'iscrizione agli eventi avviene su piattaforme esterne, con la loro informativa.</li>
        <li>Puoi esercitare i tuoi diritti in ogni momento scrivendo al titolare.</li>
      </LegalSummary>

      <LegalSection id="titolare" title="Titolare del trattamento">
        <ControllerDetails withDpo />
      </LegalSection>

      <LegalSection id="dati" title="Quali dati trattiamo, perché e su quale base">
        <LegalSubsection title="Navigazione sul sito">
          <p>
            Il sito non usa cookie di profilazione, strumenti di analisi o pubblicità e non incorpora contenuti di terzi che ti
            tracciano. Per funzionare e restare sicuro, il server che ospita il sito può registrare in log tecnici l'indirizzo IP,
            la data e l'ora, la pagina richiesta e il tipo di browser. Gli invii ai questionari sono limitati per indirizzo IP:
            il conteggio resta per un breve intervallo nella memoria del server e non viene salvato nel database.
          </p>
          <p>
            Le immagini sono servite dal nostro server. Per i relatori importati da Sessionize la foto può essere caricata
            direttamente dai server di Sessionize, che in quel caso riceve il tuo indirizzo IP.
          </p>
          <p>Base giuridica: legittimo interesse a mantenere il sito sicuro e funzionante (art. 6, par. 1, lett. f).</p>
        </LegalSubsection>

        <LegalSubsection title="Questionari di feedback">
          <p>
            Alcuni questionari sono anonimi. Altri chiedono nome, cognome ed email e il tuo consenso al trattamento: in questo caso
            salviamo nome, cognome, indirizzo email, risposte, data e ora di invio e il fatto che hai dato il consenso. Se il
            questionario ammette una sola risposta per persona, conserviamo anche una versione normalizzata dell'email per
            riconoscere i duplicati.
          </p>
          <p>
            Finalità: raccogliere e analizzare i commenti sugli eventi per migliorarli. Base giuridica: il tuo consenso (art. 6,
            par. 1, lett. a), che puoi revocare in qualsiasi momento senza pregiudicare i trattamenti già effettuati. Il
            conferimento è facoltativo, ma senza non puoi inviare un questionario che richiede di identificarti.
          </p>
          <p>
            Le risposte a testo libero possono contenere dati personali: scrivi solo ciò che vuoi condividere e non inserire dati
            particolari (per esempio sulla salute o sulle opinioni politiche e religiose).
          </p>
          <p>
            Mentre compili un questionario il tuo browser salva una bozza delle risposte, senza nome, email e consenso, per non
            farti perdere il lavoro se ricarichi la pagina. La bozza resta sul tuo dispositivo e si cancella quando invii il
            questionario: vedi la <LegalLink to="/cookie">Cookie policy</LegalLink>.
          </p>
          <p>
            Le risposte sono consultabili solo dagli amministratori autorizzati, anche in forma aggregata (statistiche). Gli
            indirizzi email raccolti non sono usati per newsletter o altre comunicazioni.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Area riservata del team">
          <p>
            Chi gestisce il sito accede con un account personale gestito da Keycloak, il servizio di accesso di Vevy Europe S.p.A.
            (hello.vevy.com). Trattiamo nome, cognome, indirizzo email, identificativo dell'account e i dati tecnici dell'accesso,
            per consentire un accesso sicuro all'area riservata. Chi visita soltanto le pagine pubbliche non entra in contatto
            con il servizio di accesso.
          </p>
          <p>Base giuridica: legittimo interesse a gestire il sito in modo sicuro (art. 6, par. 1, lett. f).</p>
        </LegalSubsection>

        <LegalSubsection title="Relatori, team e foto degli eventi">
          <p>
            Pubblichiamo nome, foto, biografia e link che i relatori e i membri del team ci hanno fornito, anche tramite il
            servizio Sessionize, da cui provengono i dati dei relatori importati. Base giuridica: consenso dell'interessato (art.
            6, par. 1, lett. a). Puoi chiedere in qualsiasi momento di modificare o rimuovere i tuoi dati.
          </p>
          <p>
            Le pagine degli eventi possono includere foto scattate durante gli incontri, pubblicate per documentare le attività
            della community (legittimo interesse, art. 6, par. 1, lett. f). Se compari in una foto e vuoi che venga rimossa,
            scrivici.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Iscrizione agli eventi e link esterni">
          <p>
            L'iscrizione agli eventi non avviene su questo sito: i pulsanti rimandano a una piattaforma esterna (per esempio
            Eventbrite), che tratta i tuoi dati come titolare autonomo secondo la propria informativa.{' '}
            <Placeholder>
              indicare se e come DotNetLiguria riceve l'elenco degli iscritti dalla piattaforma e per quanto tempo lo conserva
            </Placeholder>
          </p>
          <p>
            Le pagine contengono anche link a mappe (OpenStreetMap, Google Maps) e ai profili pubblici di relatori e team. Sono
            semplici link: non incorporano nulla finché non li apri e il servizio di destinazione applica la propria informativa.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection id="destinatari" title="A chi comunichiamo i dati">
        <ul>
          <li>
            {HOSTING_DETAILS} ospita il sito e i dati e fornisce il servizio di accesso Keycloak per l'area riservata. Tratta i
            dati per nostro conto come responsabile del trattamento (art. 28 GDPR).
          </li>
          <li>Gli amministratori del sito, del team DotNetLiguria, autorizzati ad accedere ai dati necessari al loro compito.</li>
        </ul>
        <p>
          Non vendiamo né cediamo dati a terzi. Non trasferiamo dati personali fuori dallo Spazio economico europeo.
        </p>
      </LegalSection>

      <LegalSection id="conservazione" title="Per quanto tempo conserviamo i dati">
        <ul>
          <li>Risposte ai questionari: <Placeholder>periodo di conservazione, per esempio 24 mesi dall'evento, o criterio di cancellazione</Placeholder></li>
          <li>Risposte raccolte prima dell'attuale sistema di questionari: <Placeholder>periodo o criterio di conservazione</Placeholder></li>
          <li>Log tecnici del server: <Placeholder>durata di conservazione dei log, gestiti da Vevy Europe S.p.A.</Placeholder></li>
          <li>Account dell'area riservata: <Placeholder>tempi di disattivazione o cancellazione degli account del team</Placeholder></li>
          <li>Dati di relatori e team: finché restano pubblicati. Li aggiorniamo o li rimuoviamo su richiesta.</li>
          <li>Bozza del questionario nel browser: sul tuo dispositivo fino all'invio o finché non cancelli i dati del sito.</li>
        </ul>
      </LegalSection>

      <LegalSection id="diritti" title="I tuoi diritti">
        <p>
          Puoi chiedere in qualsiasi momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del
          trattamento e, per i dati che ci hai fornito con il consenso, la portabilità (artt. 15-20 GDPR). Puoi opporti ai
          trattamenti basati sul legittimo interesse (art. 21) e revocare il consenso quando vuoi (art. 7, par. 3).
        </p>
        <p>
          Per esercitare i tuoi diritti scrivi al contatto indicato nella sezione «Titolare del trattamento», specificando, se
          ti riguarda un questionario, l'indirizzo email usato e il questionario compilato. Rispondiamo entro un mese (art. 12 GDPR). Le
          risposte ai questionari anonimi non possono essere ricondotte a una persona, quindi non possiamo modificarle o
          cancellarle su richiesta.
        </p>
        <p>
          Se ritieni che il trattamento violi la normativa puoi proporre reclamo al Garante per la protezione dei dati personali
          (<LegalExternalLink href="https://www.garanteprivacy.it">www.garanteprivacy.it</LegalExternalLink>).
        </p>
        <p>Non facciamo profilazione né prendiamo decisioni basate su trattamenti automatizzati.</p>
      </LegalSection>

      <LegalSection id="aggiornamenti" title="Aggiornamenti">
        <p>
          Aggiorniamo questa informativa quando cambia il modo in cui trattiamo i dati: la data in alto indica l'ultima
          versione. Per i cookie e gli strumenti simili vedi la <LegalLink to="/cookie">Cookie policy</LegalLink>, per le
          regole di uso del sito i <LegalLink to="/termini-di-servizio">Termini di servizio</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
