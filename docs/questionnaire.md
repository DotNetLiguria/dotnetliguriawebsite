# Questionnaires

This document records (A) every feature of the legacy questionnaire implementations and (B) the
React/MongoDB questionnaire module that replaces them. The replacement is integrated in the main
website (`DotNetLiguriaCore` + `dotnetliguriaspa`); it needs no SQL Server, no SQLite, no native
imaging libraries and no extra deployable.

## A. Legacy inventory

**Historical reference only:** both Blazor applications and their test projects have
been removed. The paths and behavior below describe the former implementation, not
projects or endpoints that still exist. Historical import remains in DataMigration.

Three independent implementations existed. None of them had a designer, an admin results view or
authentication; every questionnaire was a hard-coded "event feedback" form.

### A.1 `src/BlazorQuestionario` – hosted Blazor WebAssembly (`BlazorAppTest.*`)

| Area | Behavior |
| --- | --- |
| Pages | `/` welcome page (asks the user to scan the event QR code; states that the photo is processed and not retained). `/questionario` shows camera/video capture, canvas, video-source selector and a dev button "Simula inserimento corretto QR Code"; a recognised QR reveals the form. After submit it navigates to `/info`, which does not exist. |
| Form | `Client/Components/QuestionarioFormComponent.razor`: `EditForm` + `DataAnnotationsValidator`, `InputText`, `InputTextArea`, `InputNumber`. Text asks for ratings "da zero a dieci". |
| Flow | `GET /Questionario` creates an id, picks the *latest* workshop and fills up to five track slots (title + speakers); `POST /Questionario` stores the model as-is. |
| QR | `POST /QR/Capture` accepts one uploaded image, decodes it with ZXing + SkiaSharp (`QrPayload.Decode`), compares the payload with the latest workshop, returns 200 on match. The image is not stored. Browser capture uses JS interop (`InitPage`, `StopStream`, `[JSInvokable] OKQRCode`). |
| Persistence | EF Core `ApplicationDbContexts` with `Workshop`, `WorkshopTrack`, `WorkshopSpeaker`, `WorkshopTrackWorkshopSpeaker`, `QuestionarioTest`. Connection strings `DefaultConnection-SQL` and `DefaultConnection-Sqlite` (`Filename=blazor.sqlite`); Aspire uses `.artifacts/aspire-data/questionnaire.db` with `LocalDatabaseInitializer`. |
| Duplicates | None: client-supplied ids, no email check. |
| Auth / window | None / none. |
| Packages | Application Insights 2.23.0 (referenced, not registered), EF Core + SqlServer + Tools 10.0.12, ZXing/SkiaSharp. |

`QuestionarioTest` (WASM `Shared/QuestionarioTest.cs`):

| Field | Type | Validation |
| --- | --- | --- |
| `QuestionarioTestId` | string | key |
| `Data` | DateTime | defaults to today (local) |
| `Nome`, `Cognome` | string | required, max 50 |
| `EMail` | string | required, max 250, email format |
| `ArgomentiProxEvento` | string | – |
| `ValutazioneQualitaGeneraleEvento`, `UtilitaInformazioniRicevute` | int | `[Range(0,10)]` |
| `WorkshopId` | string | – |
| `Track01..05WorkshopTrackId` | string | – |
| `Track01..05Titolo`, `Track01..05Speaker` | string | `[NotMapped]` |
| `Track01..05Valutazione` | int | `[Range(0,10)]` |

### A.2 `src/BlazorQuestionarioServer` – Blazor Server

| Area | Behavior |
| --- | --- |
| Pages | `/` only: event introduction + form; after saving, the form is replaced with a thank-you message and a link to `https://www.dotnetliguria.net/`. Text says ratings are "da zero a cinque". |
| Flow | `Pages/Index.razor.cs` loads the current workshop from `WorkshopCorrente` (throws when missing) and fills five fixed slots (the first track is indexed without an empty-list check). |
| Duplicates | Application-level check: same email for the current workshop → "La presenta mail ha già compilato il questionario", not saved. No DB constraint. |
| Persistence | EF Core SQL Server `ApplicationDbContext` (`QuestionarioTest`, `Workshop`, `WorkshopSpeaker`, `WorkshopTrack`, `WorkshopTrackWorkshopSpeaker`, `WorkshopCorrente`), `ConnectionStrings:DefaultConnection`, migrations `20220704084551_initial` and `20230621094623_InitialCreate`. |
| Telemetry | Application Insights (disabled when `DOTNET_LIGURIA_ASPIRE=true`), a network-latency event, circuit-count meter `DotNetLiguria.Questionnaire` (`NumCircuitiAperti` every 30 s). WebSocket-only circuits. |
| Auth / window | None / none. |
| Packages | Application Insights 2.23.0, EF Core SqlServer/Tools 10.0.12, Playwright 1.56.0, Verify.Xunit/Verify.Playwright. |

Its `QuestionarioTest` differs from A.1: `QuestionarioTestId`, `WorkshopId` and the track ids are
`Guid`; it adds `ConsigliSuggerimenti`; general ratings and `Track01..03Valutazione` are
`[Range(0,5)]` while `Track04..05Valutazione` kept `[Range(0,10)]`.

### A.3 Legacy React + MongoDB feedback (inside the main website)

| Area | Behavior |
| --- | --- |
| SPA | `/feedback/:workshopId` (stars 1–5 for every track plus one free note, all ratings required) and `/admin/feedbacks` (statistics per workshop). |
| Model | Mongo `Feedback` collection: `FeedbackId` (`_id`), `WorkshopId`, `WorkshopTrackId`, `Rating`, `Note`, `WorkshopTitle`, `TrackTitle`, `CreatedDate` (local kind). |
| API | `GET /api/Workshop/GetFeedBack/{id}` (workshop + tracks + a synthetic track "Tutti" – "L'evento ha soddisfatto le tue aspettative?" – with a **new random Guid** each call); `POST /api/Workshop/SubmitFeedback` (rating 0–10, one document **per track**, same `Note` on every document, no submission id); `GET /api/Workshop/GetWorkshopsWithFeedback`; `GET /api/Workshop/GetFeedbackStatistics[/{id}]` (`FeedbackStatisticsCalculator`: eleven bins 0–10, two-decimal averages, general question detected by a null `TrackTitle`, deduplicated notes). |
| Gate | `Workshop.FeedbackEnabled` must be true for read and submit. |
| Gaps | No duplicate protection, no identity, general question identified heuristically, statistics only. |

### A.4 Tests, hosting and tooling tied to the legacy apps

- `tests/Questionnaire.Tests`: SQLite configuration, 0–10 ranges, required/email/length validation,
  EF join keys, ZXing/SkiaSharp round trip, `QrPayload`, local DB initializer.
- `tests/ServerQuestionnaire.Tests`: 0–5 / 0–10 ranges, EF join keys, initializer, circuit counter.
- `src/BlazorQuestionarioServer/BlazorQuestionarioServer.Tests`: Playwright + Verify HTML snapshots.
- `src/DotNetLiguria.AppHost/ApplicationResources.cs`: SQL Server container `sql` /
  `DotNetLiguriaAspireQuestionnaire`, resources `hosted-questionnaire` (62045) and
  `server-questionnaire` (62048).
- `DotNetLiguria.slnx` solution folders, `scripts/verify.ps1` suites `hostedQuestionnaire` and
  `serverQuestionnaire`, `scripts/verify-publish.ps1` (two extra publishes + WASM asset check),
  `scripts/timing-budgets.json`, CI, `docs/architecture.md`, `docs/aspire.md`, scoped AGENTS.md.

## B. Replacement: questionnaire module

### B.1 Goals and decisions

- Generic questionnaires, optionally linked to a workshop; a "Feedback workshop" template is
  generated from the workshop tracks.
- Respondents are anonymous or identified (name, surname, email, privacy consent) per
  questionnaire, optionally limited to one response per email.
- QR codes are **generated** for the public link (PNG/SVG download); scanning is removed.
- Engine: custom, all-MIT, on the existing SPA stack – MUI 9 + MUI X Data Grid, `@dnd-kit`
  (sortable designer), Zustand (designer store + undo/redo), Recharts (results), `qrcode.react`.
  Validation is a pure TypeScript module mirroring the server validator (no Zod: the rule set is
  small, shared with the designer checklist, and avoids a second schema language).
- Storage: MongoDB collections `Questionnaire` and `QuestionnaireResponse`.
- Admin: Keycloak role **or** claim `feedbackadmin` (names configurable).

### B.2 Model (`DotNetLiguriaCore.Model/Questionnaires`)

`Questionnaire`: `QuestionnaireId`, `Title`, `Description`, `IntroText`, `ThankYouText`, `Status`
(`Draft`, `Published`, `Closed`, `Archived`), `RespondentMode` (`Anonymous`, `Identified`),
`OnePerEmail`, `ConsentText`, `DisplayMode` (`SinglePage`, `Stepper`), `OpensAt`/`ClosesAt` (UTC),
`WorkshopId?`, `Sections[]`, `Version`, `CreatedBy`/`CreatedAt`/`UpdatedAt`/`PublishedAt`,
`Origin` (`ResponseSource`), `ResponseCount` (computed, not persisted).

`QuestionnaireSection`: `Id`, `Title`, `Description`, `Questions[]`.
`Question`: stable string `Id`, `Type`, `Title`, `HelpText`, `Required`, `Options[]`, `Rows[]`
(matrix rows, optionally tied to a `WorkshopTrackId`), `Settings` (`MaxLength`, `Min`/`Max`,
`MinLabel`/`MaxLabel`, `MinSelections`/`MaxSelections`, `AllowOther`/`OtherLabel`, `UseDropdown`,
`Placeholder`), `VisibleIf` (`QuestionId`, `Operator`: `Equals`, `NotEquals`, `Contains`,
`GreaterOrEqual`, `LessOrEqual`, `Answered`, `NotAnswered`, `Value`).

| Type | Answer field | Notes |
| --- | --- | --- |
| `ShortText`, `LongText`, `Email`, `Date` | `Text` | max length, placeholder; email/date formats checked |
| `Number` | `Number` | optional min/max |
| `YesNo` | `Bool` | |
| `SingleChoice` | `Choices[0]`, `OtherText` | radio or dropdown, optional "Altro" |
| `MultipleChoice` | `Choices`, `OtherText` | min/max selections |
| `Rating` | `Number` | stars 1..N (3–10 stars) |
| `Scale` | `Number` | numeric 0..10 style with end labels (NPS-like) |
| `Matrix` | `Rows[] {RowId, Value}` | rows × scale, used for "rate each session" |
| `InfoText` | – | static text block |

`QuestionnaireResponse`: `ResponseId`, `QuestionnaireId`, `QuestionnaireVersion`, `SubmittedAt`
(UTC), `Respondent?` (`Name`, `Surname`, `Email`, `EmailNormalized`), `ConsentGiven`,
`Answers[]`, `Source` (`Web`, `LegacyFeedback`, `LegacySqlServer`, `LegacySqlite`),
`SourceKey?` (migration idempotency) and `UniqueEmailKey?` (`{questionnaireId:N}|{email}` when
`OnePerEmail`). Indexes: (`QuestionnaireId`, `SubmittedAt`), unique sparse `UniqueEmailKey`,
unique sparse `SourceKey`, and `Questionnaire.WorkshopId`. Null keys are not serialized so the
sparse indexes ignore web responses.

### B.3 Lifecycle rules

- `Draft` → publish (server-side definition validation: title, at least one question, unique
  section/question/option/row ids, at least two distinct options for choices, stars 3–10, scales
  with min ≥ 0 and at most 11 values, coherent min/max selections, visibility rules pointing to
  *earlier* compatible questions, opening before closing, one-per-email only when identified) →
  `Published` → close/reopen → `Archived`. Delete is allowed only without responses.
- A questionnaire is open when `Published` and inside `OpensAt`/`ClosesAt`
  (`Open`, `NotPublished`, `NotYetOpen`, `Closed`).
- After the first response the **structure is locked**: question ids, types, options and rows
  cannot change (`QuestionnaireStructure.IsCompatible`); texts, help, window and messages can.
  Use *Duplica* to evolve a questionnaire. Updates use optimistic concurrency on `Version`.

### B.4 API

Admin – `api/Questionnaire`, policy `FeedbackAdmin` (JWT bearer):

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | list with response counts |
| GET | `/{id}` | definition |
| GET | `/by-workshop/{workshopId}` | questionnaires linked to a workshop |
| POST | `/` | create (blank or workshop-feedback template) |
| PUT | `/{id}` | update (structure lock, version check → 409) |
| POST | `/{id}/duplicate`, `/publish`, `/close`, `/reopen`, `/archive` | lifecycle |
| DELETE | `/{id}` | delete (no responses) |
| GET | `/{id}/statistics` | aggregated results |
| GET | `/{id}/responses` | raw responses |
| DELETE | `/{id}/responses/{responseId}` | remove a response |
| GET | `/{id}/export` | CSV (UTF-8 BOM for Excel) |

Public – `api/PublicQuestionnaire`, anonymous, fixed-window rate limit (20 requests/minute per
client IP):

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/{id}` | public view (definition + availability) |
| GET | `/by-workshop/{workshopId}` | open questionnaire of a workshop, else the latest published/closed |
| POST | `/{id}/responses` | submit; server validation mirrors the client, honours visibility, 409 on duplicate email, honeypot field `website` |

The admin policy accepts the configured role in `realm_access.roles`, `resource_access.*.roles`
or `roles`, or a claim with the configured name (`QuestionnaireAuthorization:AdminRole` /
`AdminClaim`, both default `feedbackadmin`).

### B.5 Public runner (`/q/:questionnaireId`, `/feedback/:workshopId`)

- Mobile first (participants arrive from a QR code at the event); MUI controls with labels and
  accessible errors.
- Single page or stepper (one section per step) with progress bar.
- Conditional visibility evaluated live; hidden answers are not submitted.
- Identified mode: name/surname/email + consent checkbox with the configured privacy text.
- Unsent answers are kept in `localStorage` and cleared after submit.
- Italian messages for not found, not yet open, closed, duplicate email and thank-you.
- `/feedback/:workshopId` keeps the old QR links working: it resolves the workshop's questionnaire.

### B.6 Designer (`/admin/questionnaires/:id/edit`)

The designer is the core of the admin experience:

- **Three panes**: question-type palette (click to append or drag onto the canvas), canvas with
  sections and question cards, properties panel for the selected question or the questionnaire.
- **Canvas**: drag-and-drop and keyboard reordering of sections and questions (dnd-kit), inline
  title editing, duplicate/delete, required toggle, type icons. On narrow screens the three panes
  become tabs (canvas, palette, properties).
- **Properties**: type-specific settings; option/row editor with paste-many (one per line),
  reorder and "Altro"; scale labels and range; visibility-rule builder limited to earlier questions.
- **Questionnaire settings**: title, descriptions, intro/thank-you texts, respondent mode, consent
  text, one-per-email, display mode, opening window, linked workshop banner.
- **Toolbar**: debounced autosave (1.2 s) with status indicator and conflict detection,
  undo/redo (100 steps, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), live preview using the real runner in desktop and mobile
  frames, publish dialog with a validation checklist, share dialog (copy link, QR PNG/SVG download).
- **Templates**: blank, workshop feedback (overall rating, usefulness, per-session matrix, topics,
  suggestions), duplicate existing.
- **Locked banner** when responses exist; structural controls are disabled.

### B.7 Admin list and results

- `/admin/questionnaires`: Data Grid (title, event, status, opening window, responses, last
  modified) with create, edit, results, duplicate, archive and delete; legacy `/admin/feedbacks`
  redirects here.
- Workshop detail: panel listing linked questionnaires and "Crea questionario di feedback".
- `/admin/questionnaires/:id/results`: KPI cards, responses per day, per-question cards
  (distribution + average for rating/scale/matrix rows, bars for choices, searchable text answers),
  responses grid with detail dialog and delete, CSV export. Historical data uses the same views.
- The three admin pages are lazy-loaded so public visitors do not download the designer.

### B.8 Migration of historical data

`DataMigration questionnaires` converts every legacy source into **closed** historical
questionnaires (`Origin` = source, `CreatedBy` = `DataMigration`, all questions optional):

| Source | Questionnaire | Responses |
| --- | --- | --- |
| Mongo `Feedback` | one per workshop: `Feedback (storico) - <workshop>`; `overall` (Rating 1–5, or Scale 0–N when a 0 or a value above 5 was recorded), `tracks` matrix (workshop tracks plus orphan tracks seen in data), `suggestions` | rows grouped into submissions: same workshop, same note, ≤ 5 s from the previous row, no repeated slot; the synthetic "Tutti" track (not a workshop track and no `TrackTitle`) maps to `overall`, the note to `suggestions` |
| SQL Server `QuestionarioTest` | one per workshop: `Questionario (storico SQL Server) - <workshop>`, identified; `overall`/`usefulness` Scale 0–5; one Scale question per track (`track-<id>`), 0–5 for slots 1–3 and 0–10 for slots 4–5; `topics`, `suggestions` | one per row, respondent name/surname/email (consent not recorded) |
| SQLite `QuestionarioTest` | as above with every scale 0–10 and no `suggestions` | one per row |

- Questionnaire and response ids are deterministic (SHA-256 based Guids of the source key) and
  every response carries `SourceKey` (`LegacyFeedback:<first FeedbackId>`,
  `LegacySqlServer:<id>`, `LegacySqlite:<id>`); reruns insert only missing data and never
  overwrite existing questionnaires.
- Empty track slots are skipped; out-of-range ratings are skipped and reported.
- Track titles/speakers come from the Mongo workshop when it exists; otherwise a warning is
  reported and generic titles are used.
- The report lists every questionnaire, response counts, new rows and warnings (ambiguous
  feedback grouping, missing workshops, out-of-range values). Personal data is never printed.

Usage (from `src/dotnetliguriawebsite/DataMigration`; MongoDB settings come from the existing
`DotNetLiguriaDatabase` section, user secrets or environment variables):

```powershell
dotnet run -- questionnaires                       # dry run: Mongo Feedback only
dotnet run -- questionnaires --sqlserver "<cs>" --sqlite "Data Source=<file>"   # dry run, all sources
dotnet run -- questionnaires --apply ...            # writes to MongoDB
```

Connection strings can also be provided as `QuestionnaireMigration:SqlServerConnectionString` and
`QuestionnaireMigration:SqliteConnectionString` (preferably user secrets), `--no-feedback` skips
the Mongo source. Without the `questionnaires` argument the executable keeps its original
workshop migration behavior (it reads the historical SQL database, then imports `json/` into
MongoDB); `--from-json` skips the SQL read and imports only the checked-in `json/` export.
**Run `--apply` against real data only after explicit approval and a reviewed dry run.**

Populating the local Aspire MongoDB container (database `DotNetLiguriaAspire`, TLS with the Aspire
development certificate). Run from `src/dotnetliguriawebsite/DataMigration` while the AppHost
containers are running; the password is read from the container and never printed:

```powershell
$pw   = docker exec <mongo-container> printenv MONGO_INITDB_ROOT_PASSWORD
$port = ((docker port <mongo-container> 27017) -split ':')[-1]
$env:DotNetLiguriaDatabase__DatabaseName = 'DotNetLiguriaAspire'
$env:DotNetLiguriaDatabase__ConnectionString =
    "mongodb://admin:$([uri]::EscapeDataString($pw))@127.0.0.1:$port/?authSource=admin&tls=true&tlsInsecure=true"
dotnet run -c Release -- --from-json             # workshops, speakers, files, board, file types, top menu
dotnet run -c Release -- questionnaires          # dry run report
dotnet run -c Release -- questionnaires --apply  # historical questionnaires + SourceKey index
```

`tlsInsecure=true` is acceptable only for the local development container. Re-running `--from-json`
is safe: existing documents are skipped, and the board and top menu are seeded only when their
collections are empty.

### B.9 Removal completed

Both Blazor source trees, their Shared projects, unit/browser tests and generated
outputs are removed. The nine-project root solution contains only the website,
website libraries, DataMigration, Aspire and the two remaining unit-test projects.
Aspire starts only the website, React SPA and MongoDB; it no longer provisions SQL
Server, SQLite, questionnaire services or circuit telemetry. Native imaging and
legacy browser-test dependencies are gone, including their CI and verification hooks.

The obsolete workshop feedback endpoints (`GetFeedBack`, `SubmitFeedback`,
`GetWorkshopFeedbackSummary`, `GetWorkshopsWithFeedback`, `GetFeedbackStatistics`),
their services and DTOs are removed. `/feedback/:workshopId` remains a public React
questionnaire alias; `/admin/feedbacks` redirects to `/admin/questionnaires`.
`Workshop.FeedbackEnabled` stays for persisted/public contract compatibility.

All historical SQL Server, SQLite and Mongo Feedback import logic is self-contained
in `DataMigration/Questionnaires`, including the former Feedback BSON model and its
collection setting. SQL/SQLite packages are needed only by that manual tool, not
the website or AppHost. Its offline mapping/serialization tests remain in the backend
unit suite. No legacy applications are required to import historical answers.
Existing database volumes and local database files are not deleted by source cleanup.

### B.10 Open points

- Create the `feedbackadmin` realm/client role (or claim mapper) in Keycloak and assign it.
- Decide a retention policy for historical personal data (SQL names/emails were collected
  without an explicit consent field); the migration copies them as-is.
- Feedback grouping is heuristic: review ambiguous groups in the dry-run report.
