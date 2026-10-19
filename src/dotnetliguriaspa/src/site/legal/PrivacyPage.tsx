import React from 'react';
import LegalPage, {
  ControllerDetails, LegalExternalLink, LegalLink, LegalSection, LegalSubsection, LegalSummary,
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
        <li>I questionari possono essere anonimi o collegati al tuo account nell’Identity Provider. Nome, cognome ed email dell'account restano nel servizio di identità.</li>
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
            Alcuni questionari sono anonimi; altri richiedono l'accesso con l’Identity Provider e il consenso al trattamento.
            Per i nuovi invii autenticati salviamo solo il riferimento immutabile all'account (emittente e soggetto),
            le risposte, la data e il consenso, non nome, cognome o email. Il riferimento resta un dato personale
            ed è usato anche per impedire invii duplicati quando previsto. Gli invii anonimi non sono collegati all'account,
            neppure quando hai già effettuato l'accesso.
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
            Il browser conserva temporaneamente una bozza delle risposte nella memoria della scheda (sessionStorage),
            con scadenza dopo 30 minuti senza modifiche. Puoi scartarla; viene rimossa dopo l'invio, lo scarto
            o la chiusura della scheda. Le vecchie bozze persistenti vengono eliminate, non recuperate.
            Anche una bozza può contenere dati personali nel testo libero: vedi la <LegalLink to="/cookie">Cookie policy</LegalLink>.
          </p>
          <p>
            Le risposte sono consultabili solo dagli amministratori autorizzati, anche in forma aggregata (statistiche). Gli
            indirizzi email raccolti non sono usati per newsletter o altre comunicazioni.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Account e area riservata">
          <p>
            Amministratori e partecipanti ai questionari autenticati accedono con l’Identity Provider, il servizio di accesso
            di Vevy Europe S.p.A. (hello.vevy.com). Nome, cognome ed email dell'account sono conservati nell’Identity Provider,
            non nel database applicativo. L'applicazione usa riferimenti immutabili per autorizzazione e attribuzione.
            La sola visita delle pagine pubbliche non richiede l'accesso.
          </p>
          <p>
            Nell’<LegalLink to="/area-personale">area personale</LegalLink> puoi leggere i dati attribuibili
            al tuo account, consultare la lista dei consensi, esportare i dati e richiedere la cancellazione.
            Nome e cognome si modificano nell’area personale, che inoltra le modifiche all’Identity Provider senza salvarli localmente.
            Email e sicurezza si modificano nella console dell’account dell’Identity Provider.
            L’accesso personale non concede funzioni di amministrazione.
          </p>
          <p>Base giuridica: legittimo interesse a gestire il sito in modo sicuro (art. 6, par. 1, lett. f).</p>
        </LegalSubsection>

        <LegalSubsection title="Comunicazioni sugli eventi">
          <p>
            Per fare parte della community è necessario ricevere email sui nuovi eventi. Questo è il requisito minimo
            dell'account e non può essere revocato separatamente: se non vuoi più ricevere queste comunicazioni, puoi
            cancellare definitivamente il tuo account dall'area personale.
          </p>
          <p>
            La lista dei consensi dell'area personale riporta attualmente questo solo requisito; in futuro mostrerà
            tutti i consensi che l'utente accetta di fornire a DotNetLiguria.
          </p>
          <p>
            Al momento non è configurato un servizio di invio: preparare un avviso non significa averlo inviato.
            Prima di attivarlo devono essere approvati il fornitore e le relative informative.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Relatori, team e foto degli eventi">
          <p>
            Pubblichiamo nome, foto, biografia e link che i relatori e i membri del team ci hanno fornito, anche tramite il
            servizio Sessionize, da cui provengono i dati dei relatori importati. Base giuridica: consenso dell'interessato (art.
            6, par. 1, lett. a). Puoi chiedere in qualsiasi momento di modificare o rimuovere i tuoi dati.
            Gli indirizzi di contatto editoriali eventualmente conservati sono privati e accessibili soltanto
            agli amministratori autorizzati.
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
            Eventbrite), che tratta i tuoi dati come titolare autonomo secondo la propria informativa.
            Conserviamo i dati degli iscritti agli eventi e non li cediamo a terze parti. I dati possono tuttavia
            provenire da piattaforme terze, quali Eventbrite, alle cui informative privacy gli iscritti possono fare riferimento.
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
            {HOSTING_DETAILS} ospita il sito e i dati e fornisce il servizio di accesso Identity Provider per l'area riservata. Tratta i
            dati per nostro conto come responsabile del trattamento (art. 28 GDPR).
          </li>
          <li>Gli amministratori del sito, del team DotNetLiguria, autorizzati ad accedere ai dati necessari al loro compito.</li>
        </ul>
        <p>
          Non vendiamo dati personali. I dati degli utenti DotNetLiguria sono conservati in servizi cloud che adottano
          misure adeguate alla protezione dei dati personali, nel rispetto della normativa applicabile.
        </p>
      </LegalSection>

      <LegalSection id="conservazione" title="Per quanto tempo conserviamo i dati">
        <ul>
          <li>Dati dimostrabilmente e irreversibilmente anonimi: possono essere conservati senza scadenza,
            previa approvazione delle finalità da parte del titolare. Rimuovere un identificativo non basta a renderli anonimi.</li>
          <li>Risposte collegate all'account e altri dati identificabili: conservati insieme alle preferenze dell'utente e gestibili dall'utente stesso nell'area personale.</li>
          <li>Risposte raccolte prima dell'attuale sistema di questionari: conservate insieme alle preferenze dell'utente e gestibili dall'utente stesso nell'area personale.</li>
          <li>Log tecnici del server: un anno.</li>
          <li>Account dell'area riservata: conservati insieme alle preferenze dell'utente e gestibili dall'utente stesso nell'area personale.</li>
          <li>Dati di relatori e team: finché restano pubblicati. Li aggiorniamo o li rimuoviamo su richiesta.</li>
          <li>Bozza del questionario: nella memoria della scheda del browser, massimo 30 minuti senza modifiche e comunque non oltre la chiusura della scheda.</li>
          <li>Copie di sicurezza: le copie interessate da una cancellazione devono essere eliminate o rese
            irreversibilmente anonime; le copie non interessate possono essere conservate. Copie esterne e
            precedenti esportazioni richiedono una verifica operativa separata.</li>
        </ul>
      </LegalSection>

      <LegalSection id="diritti" title="I tuoi diritti">
        <p>
          Puoi chiedere in qualsiasi momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del
          trattamento e, per i dati che ci hai fornito con il consenso, la portabilità (artt. 15-20 GDPR). Puoi opporti ai
          trattamenti basati sul legittimo interesse (art. 21) e revocare il consenso quando vuoi (art. 7, par. 3).
        </p>
        <p>
          Per esercitare i tuoi diritti usa le funzioni privacy dell'account o scrivi al titolare, indicando il
          questionario interessato senza inviare password o token. Rispondiamo entro un mese (art. 12 GDPR).
          Il testo libero può consentire di riconoscere una persona anche in un questionario definito anonimo:
          ogni richiesta deve essere valutata, senza presumere che l'assenza di un account garantisca l'anonimato.
        </p>
        <p>
          La cancellazione dell'account richiede una verifica MFA recente e riguarda il profilo nell’Identity Provider, i dati
          applicativi e le copie interessate. Configurazioni di conservazione non sicure o errori operativi
          impediscono di dichiararla conclusa; lo stato deve indicare il blocco e richiede intervento del titolare.
        </p>
        <p>
          La rimozione dell’identità nell’Identity Provider è automatica quando configurata e disponibile. Se occorre
          rimuoverla manualmente, dopo aver verificato la disabilitazione dell’account e rimosso i dati
          del sito e le copie interessate, la richiesta viene accettata ma resta pendente.
          Solo gli amministratori autorizzati possono consultare il riferimento minimo emittente/soggetto
          necessario alla rimozione, con una verifica MFA recente. La cancellazione si conclude soltanto
          dopo aver verificato l’assenza dell’identità; il riferimento operativo viene quindi eliminato.
          Un eventuale avviso email agli amministratori non contiene l’identità o l’identificativo della richiesta
          e non abilita l’invio degli avvisi sugli eventi.
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
