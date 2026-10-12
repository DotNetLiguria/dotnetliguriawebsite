# Eventbrite integration

This document describes the Eventbrite draft and ticket workflow in the workshop
admin. Local workshop publication and Eventbrite publication are independent. Saving
a workshop does not create or update an Eventbrite event; an admin explicitly starts
that operation from the final Eventbrite step.

## Configure backend credentials

The API token is a secret accepted by Eventbrite's API as a bearer token. Keep it on
the server. Do not put it in `VITE_*` variables, browser storage, a checked-in
`appsettings*.json`, logs, screenshots, or source control. Configure these values
using the website project's user secrets for local development, or the deployment's
secret store/environment configuration:

```powershell
dotnet user-secrets set "Eventbrite:AccessToken" "<eventbrite-bearer-token>" --project src\dotnetliguriawebsite\DotNetLiguriaCore
dotnet user-secrets set "Eventbrite:OrganizationId" "<organization-id>" --project src\dotnetliguriawebsite\DotNetLiguriaCore
dotnet user-secrets set "Eventbrite:OrganizerId" "<organizer-id>" --project src\dotnetliguriawebsite\DotNetLiguriaCore
```

The account/token must have permission to manage the configured organization's
venues, events, descriptions, and ticket classes, and read the managed ticket class.
Optional settings are:

| Setting | Default | Purpose |
| --- | --- | --- |
| `Eventbrite:TimeZoneId` | `Europe/Rome` | Timezone for agenda times and ticket sales-window input |
| `Eventbrite:Currency` | `EUR` | Event currency |
| `Eventbrite:CountryCode` | `IT` | Venue country |

The Eventbrite endpoints are called by the backend. Do not expose credentials to the
React application. Eventbrite access/permission must be tested against a
non-production account before production use.

## Admin workflow

Open **Eventi → the event** in the admin. The wizard sequence (Italian labels in the
UI) is Pubblicazione, Locandina, Informazioni, Sede, Sessioni, Elenco talk, Agenda e
orari, Iscrizione, Materiali, and Foto. The **Iscrizione** step is the Eventbrite
setup step after the schedule; its buttons are "Salva iscrizione e agenda" (save
registration and agenda), "Crea la bozza su Eventbrite" / "Sincronizza con
Eventbrite" (create draft / sync), "Aggiorna le vendite" (refresh live ticket
sales), "Salva capienza biglietti" (save ticket capacity) and "Pubblica su
Eventbrite" (publish).

1. Complete the workshop title, description, event date, venue/location, agenda
   track, and at least one scheduled agenda item. Give agenda items valid start and
   end times on the workshop event date.
2. In **Registration details**, set the available free-ticket capacity. This is the
   Eventbrite ticket inventory, not `Location.MaximumSpaces` (the venue capacity).
   Optionally set ticket sales start/end. These local date/time values use the
   configured Eventbrite timezone; if both are set, the end must be later than the
   start. Booking/cancellation URL and attendee notes are local workshop fields.
3. Save registration/agenda details to persist them on the website. This does not
   call Eventbrite. The panel lists missing required event inputs when it cannot
   synchronize yet.
4. Select **Create Eventbrite draft** for a new event or **Sync/Update Eventbrite**
   for an existing event. The backend creates/updates the venue, event, structured
   description/agenda, and the integration-managed free ticket. Event start/end are
   derived from the earliest/latest agenda times and the configured timezone.
   Workshop description is the short summary (truncated to Eventbrite's 140
   characters) and is also included with the agenda in the structured event
   description.
5. For an existing event, select **Refresh live ticket sales** to fetch current
   aggregate ticket-class counts: sold, pending, total capacity, and remaining
   tickets, with a refresh timestamp. No attendee names, email addresses, or
   order-level personal data are retrieved or shown.
6. Increase the desired ticket capacity when additional seats should be released.
   The admin API refreshes the current Eventbrite inventory before accepting a
   capacity change and rejects a requested total below sold plus pending tickets.
   Saving the desired capacity is local only; use **Sync/Update Eventbrite** to
   apply the new total to the provider. Eventbrite remains the final authority and
   may reject a change if inventory has changed or its own holds/constraints apply.
   The integration does not reduce the last synchronized total.
7. When the draft is ready for public sale, select **Publish on Eventbrite** and
   confirm. Publishing on Eventbrite is separate from the website's **Published**
   setting. A published Eventbrite event can still be synchronized after a later
   edit; do not publish it a second time.

The status and last successful sync time are shown in the panel. A pending status
means local data changed and should be synchronized explicitly. Provider failures
are shown with the sync status/error; correct the data or configuration and retry
from the final step.

## Recovery and boundaries

An Eventbrite create/update can succeed remotely while its response is lost. The
integration records ambiguous create outcomes as requiring reconciliation and
refuses an unsafe blind retry that could create duplicates. Check the organization's
Eventbrite account and reconcile the event/ticket identity before taking further
action. A definitive HTTP rejection is shown as a provider error and can generally
be retried after correcting its cause.

Venue and event images are not uploaded to Eventbrite by this integration. The
workshop's website image remains local. Ticket reporting is limited to the single
free-ticket class managed by this integration; additional ticket classes created
directly in Eventbrite are not aggregated into these counts. There is no background
sync: workshop saves are local, and the admin explicitly synchronizes changes.

Do not use production tokens or attendee records in tests. Automated API tests use
a fake HTTP handler. Before enabling the integration for an account, confirm token
acceptance, organization/organizer access, inventory field behavior, and event
updates in a non-production Eventbrite account.
