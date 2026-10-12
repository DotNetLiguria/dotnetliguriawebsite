# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Sviluppatori .NET professionisti** (primari): un pubblico esperto, spesso senior e abituato ad ambienti di lavoro strutturati. Vogliono sapere qual è il prossimo evento, valutare in pochi secondi il livello tecnico dei talk, iscriversi e ritrovare slide e materiali dei talk passati. Arrivano spesso dal telefono, da un post social o da un link condiviso.
- **Aspiranti speaker**: sviluppatori della community che vogliono proporre un talk e capire come funziona.
- **Studenti e chi inizia**: scoprono la community, vogliono capire se è un posto adatto anche a loro.
- Aziende, sponsor e sedi ospitanti non sono il pubblico primario del sito (confermato 2026-10-10).

## Product Purpose

Il sito della community DotNetLiguria porta le persone al prossimo incontro dal vivo e custodisce la memoria di tutti quelli passati. Successo: un visitatore capisce entro pochi secondi quando e dove è il prossimo evento e raggiunge l'iscrizione; chi ha partecipato ritrova i materiali e lascia il feedback dal telefono.

## Positioning

User group .NET con eventi dal vivo dal 2011 in sedi della Liguria (La Spezia, Genova, Imperia): talk tecnici di livello professionale. L'archivio di 41 eventi, 130 talk e 30 speaker in oltre quindici anni è la prova che nessun altro sito può copiare.

## Operating Context

- L'iscrizione agli eventi avviene su una piattaforma esterna (quale piattaforma: da confermare); il sito rimanda lì.
- Durante l'evento i partecipanti scansionano un QR code e compilano il questionario di feedback dal telefono (`/q/:questionnaireId`, `/feedback/:workshopId`).
- Un piccolo team di volontari gestisce eventi, speaker, board e questionari dall'area admin (autenticazione Keycloak).
- Il sito pubblico attuale su dotnetliguria.net è un'applicazione legacy (template Bootstrap "Unify") che la SPA React del repository sostituirà.

## Capabilities and Constraints

- SPA React 19 + Vite in `src/dotnetliguriaspa`, servita da ASP.NET Core (.NET 10) con API su `/api` e asset storici su `/Contents`.
- Route, payload delle API, callback OIDC e URL del service worker restano invariati (vincolo del repository).
- Stack UI deciso il 2026-10-10: Tailwind CSS 4.3 e React Aria Components, su pagine pubbliche e admin; MUI, Emotion e styled-components rimossi il 2026-10-12.
- Il gate di verifica richiede almeno 384 test Vitest.
- Contenuti indispensabili: archivio dal 2011 con materiali, questionario da QR, chi siamo e board, canali della community.
- Da decidere: piattaforma di iscrizione esterna; canali ufficiali attivi della community.
- La riprogettazione della UI richiede l'approvazione dei maintainer (l'AGENTS.md della SPA oggi chiede di preservare la UI esistente).

## Brand Commitments

- Nome: DotNetLiguria; il logo attuale scrive "DotNet Liguria".
- Logo: basilico e arco della costa con la scritta. Si ridisegna fedelmente in SVG, con un simbolo separato per favicon e icone e varianti navy, bianca e su sfondo scuro. Nessun cambio di identità (deciso 2026-10-10).
- Lingua del sito: italiano.
- Tono tecnico, diretto e professionale. Niente folklore regionale nell'interfaccia: l'identità ligure vive nel logo e nei fatti (città e sedi degli eventi), non in decorazioni o metafore locali (deciso 2026-10-10).
- Nessun riferimento pubblico alle aziende di provenienza dei partecipanti.
- Il sito deve essere bello e attraente come un sito di community o di conferenza moderno, accogliente e curato: niente estetica da terminale, CLI o documento tecnico (deciso 2026-10-10 dopo aver visto la direzione "Specifica tecnica" nella SPA).
- Riferimento visivo scelto dall'utente: il sito attuale (dotnetliguria.net: logo, verde, foto degli eventi) rifatto in chiave moderna. I colori del logo sono protagonisti: ciano dell'arco e verde basilico in grandi campiture, navy per i testi, il verde del sito attuale come accento.

## Evidence on Hand

- Export storico di eventi, track, speaker, board e menu in `src/dotnetliguriawebsite/DataMigration/json/`.
- Locandine, foto e materiali degli eventi in `src/dotnetliguriawebsite/DotNetLiguriaCore/Contents/workshops/`.
- Logo in `src/dotnetliguriaspa/src/assets/logo/`: per ora il sito usa il logo storico di dotnetliguria.net (PNG, con una variante a scritta bianca per il piè di pagina); il nuovo logo vettoriale (compatto, esteso, basilico) è pronto per quando verrà adottato (deciso 2026-10-11).
- Assenti, da non inventare: testimonianze, numeri di partecipanti, sponsor, premi.

## Product Principles

1. Il prossimo evento prima di tutto: data, luogo e iscrizione sempre a un tocco.
2. L'archivio è la prova: quindici anni di eventi reali valgono più di qualsiasi slogan.
3. Persone vere: speaker e organizzatori con nome e volto.
4. Rispetto per un pubblico esperto: contenuti tecnici in primo piano, niente toni promozionali o da principianti.
5. Telefono prima di tutto: si arriva da un post o da un QR in sala.
6. Accessibile per tutti, senza eccezioni.

## Accessibility & Inclusion

WCAG 2.2 livello AA, mobile first, `lang="it"`, utilizzo completo da tastiera e screen reader, rispetto di `prefers-reduced-motion`.
