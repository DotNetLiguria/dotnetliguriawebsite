import React from 'react';
import LegalPage, {
  ControllerDetails, LegalExternalLink, LegalLink, LegalSection, LegalSummary,
} from './LegalPage';
import { HOSTING_DETAILS } from './legalFacts';

/** Termini di servizio. Draft to be reviewed by whoever follows the association's legal matters. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Termini di servizio"
      description="Le regole di uso del sito di DotNetLiguria: contenuti, link esterni, limiti di responsabilità e legge applicabile."
    >
      <LegalSummary>
        <li>Il sito presenta gli eventi della community e raccoglie feedback tramite questionari.</li>
        <li>I contenuti dei talk appartengono ai rispettivi autori.</li>
        <li>Il sito è offerto così com'è, da una community di appassionati.</li>
      </LegalSummary>

      <LegalSection id="chi-siamo" title="Chi gestisce il sito">
        <p>
          Il sito è gestito da DotNetLiguria, la community .NET della Liguria, con eventi dal vivo dal 2011. Serve a far
          conoscere i prossimi incontri, conservare programma, relatori e materiali di quelli passati e raccogliere feedback
          tramite questionari. Usandolo accetti questi termini.
        </p>
        <ControllerDetails />
        <p>Il sito è ospitato da {HOSTING_DETAILS}.</p>
      </LegalSection>

      <LegalSection id="uso" title="Come usare il sito">
        <p>Puoi consultare il sito liberamente. Ti chiediamo di:</p>
        <ul>
          <li>usarlo in modo lecito e rispettoso degli altri;</li>
          <li>non inviare nei questionari dati falsi o di altre persone e non usare strumenti automatici per inviare risposte;</li>
          <li>non cercare di accedere all'area riservata, che è destinata ai soli membri autorizzati del team;</li>
          <li>non compromettere la sicurezza o il funzionamento del sito.</li>
        </ul>
        <p>
          Come trattiamo i dati personali è spiegato nell'<LegalLink to="/privacy">Informativa sulla privacy</LegalLink>; i
          cookie e gli strumenti simili sono descritti nella <LegalLink to="/cookie">Cookie policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection id="contenuti" title="Contenuti e proprietà intellettuale">
        <p>
          I contenuti dei talk (slide, video, codice e altri materiali) appartengono ai rispettivi autori, che ne mantengono
          tutti i diritti: per riutilizzarli chiedi a loro.
        </p>
        <p>
          Il nome e il logo DotNetLiguria identificano la community: non usarli in modo da far credere a un'affiliazione o a
          un'approvazione che non esiste.
        </p>
        <p>
          Il codice sorgente del sito è pubblicato su{' '}
          <LegalExternalLink href="https://github.com/DotNetLiguria/dotnetliguriawebsite">GitHub</LegalExternalLink> con
          licenza MIT.
        </p>
        <p>
          Se ritieni che un contenuto violi i tuoi diritti scrivi al contatto indicato in questa pagina, specificando la
          pagina interessata: lo verifichiamo e, se serve, lo rimuoviamo.
        </p>
      </LegalSection>

      <LegalSection id="link" title="Link a siti esterni">
        <p>
          Il sito rimanda a mappe, profili pubblici di relatori e team e piattaforme di iscrizione agli eventi (per esempio
          Eventbrite). Non controlliamo questi siti e non siamo responsabili dei loro contenuti, della loro disponibilità o
          delle loro informative. L'iscrizione a un evento è regolata dalle condizioni della piattaforma usata.
        </p>
      </LegalSection>

      <LegalSection id="eventi" title="Eventi e informazioni pubblicate">
        <p>
          Date, sedi e programmi sono indicativi e possono cambiare, anche all'ultimo momento: controlla sempre la pagina
          dell'evento.
        </p>
      </LegalSection>

      <LegalSection id="responsabilita" title="Limiti di responsabilità">
        <p>
          DotNetLiguria è una community di appassionati. Il sito e i materiali sono forniti «così come sono», senza garanzie di
          continuità, completezza o adeguatezza a uno scopo specifico. Per quanto consentito dalla legge, DotNetLiguria non
          risponde dei danni derivanti dall'uso del sito, dei materiali dei talk o dei siti collegati. Restano salvi i diritti
          che la legge non permette di escludere.
        </p>
      </LegalSection>

      <LegalSection id="modifiche" title="Modifiche">
        <p>
          Possiamo modificare il sito e questi termini. La data in alto indica l'ultima versione; continuando a usare il sito
          dopo una modifica accetti la versione aggiornata.
        </p>
      </LegalSection>

      <LegalSection id="legge" title="Legge applicabile">
        <p>
          Questi termini sono regolati dalla legge italiana. Restano ferme le norme inderogabili a tutela dei consumatori.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
