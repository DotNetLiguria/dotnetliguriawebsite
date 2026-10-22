# Audit of the local JSON import — 2026-10-22

The initial audit found a shared folder. The subsequent online comparison and
local repair resolved it without stopping the app or changing Test's record/image.
Four source files returning 404 and four external poster references remain
documented limitations for production review. Production itself was not changed.

## Online cross-check and completed local repair

On 2026-10-22 all 44 original event pages were fetched directly from
`https://www.dotnetliguria.net/Workshops/Detail?WorkshopId=<source ID>`.
Their titles, dates, track counts, track titles, times, abstracts and speaker names
matched JSON, including all 160 tracks. The live year-filtered event index was
also checked across all 15 year-filter pages: its 41 distinct event IDs are all
in the export. Three additional exported events are not listed in those public
indexes, but their direct detail pages remain reachable and matched JSON.
All three are marked `Published: false` in the export.

Forty event posters were downloaded from their GUID-based paths on the live
website. Four other events reference third-party images; the existing local
historical images were retained without claiming original-byte verification.

The 135 exported file references point to 119 unique source URLs. Downloads
recovered 130 references; one additional large archive was available but exceeded
the audit's 64 MiB download limit and already has a local file. Four URLs returned
404. Of the 75 initially missing local references, 71 were recovered into new
ID-based paths. Existing historical files were not overwritten.

The online March 5 poster was downloaded from:
`https://www.dotnetliguria.net/Uploads/workshops/dcb2f15f-f653-469f-91e6-568cccc7ca2d/logo.png`.
Its SHA256 is `b2b2f1b0412607872efe5771d09335198bd3b49aeb0905867667c6cecc741d15`.
The running backend at `https://localhost:5443` serves these exact bytes at
`/Contents/imported/workshops/dcb2f15f-f653-469f-91e6-568cccc7ca2d/poster.png`.
Test retains its original `/workshops/workshop043/workshop.png` reference and
poster bytes. March 5's folder is now `workshop-dcb2f15f-f653-469f-91e6-568cccc7ca2d`.

All 111 new assets (40 posters and 71 recovered file references) were requested
through the live backend; all returned 200 and matched their source SHA256.
The independent database comparison now checks 2,753 source/mapping values with
zero mismatches, zero shared folders, and four missing local media references.
After the repaired import was repeated without the repair switch, all 18
collections were compared again and no records or values changed.
The [provenance manifest](../src/dotnetliguriawebsite/DataMigration/json/workshopAssetSources.json)
records exact URLs, hashes, destinations and source limitations.

The importer now reads stable-ID folder/image/file maps instead of assigning
ownership by chronology. A reviewed folder repair requires an explicit switch;
destination folders already owned by another event are rejected even with it.

The sections below preserve the findings from the **initial, pre-repair audit**.

## Confirmed defect

March 5, 2026 (`dcb2f15f-f653-469f-91e6-568cccc7ca2d`) was assigned
`workshop043` by its chronological position in the export. The pre-import backup
shows that folder already belonged to the local Test event
(`aa8c8a5f-9961-4080-9445-81f5b158e5fd`). Both events now reference the same
poster path. The live API and served image confirm this shared path.

This was missed because the original verification compared stored values with
the importer's output, rather than independently checking folder ownership.
The original completion statement overstated the verification.

The original folder contains a March 5 Season of AI poster as `workshop.png` and a
Generative AI diagram as `workshop.old`. Repository history records both files;
the JSON's GUID-based original upload path is absent. Selecting the correct
original image initially required confirmation. The subsequent online check
provided that evidence; neither historical file was overwritten.

## Independent source and backup comparison

The audit decoded the pre-import MongoDB archive directly, without restoring it
over any database. It compared all 18 collections with a read-only snapshot of
the current development database. Canonical Extended JSON retained 64-bit values
without numeric rounding. Private snapshots remain under ignored `.artifacts`.

| Collection group | Result compared with backup |
| --- | --- |
| Workshop | 36 added; 8 existing records changed only in Tracks; no deletions |
| Speaker | 4 added; all 32 existing records unchanged |
| WorkshopFile | 135 added; all 61 existing records unchanged |
| Other 15 collections | No added, removed, or changed records |

Within the eight changed workshop track arrays, no pre-existing track IDs were
removed. Speaker ID lists changed on 26 tracks to match JSON. The replacement
also removed stored `SpeakersName` and `SpeakersDetails` fields from 48 tracks;
the public API derives those display fields from speaker records when reading.
These nested changes are included in the audit rather than treated as unchanged
merely because workshop IDs and counts stayed stable.

An independent comparison checked 2,621 source field/relationship values for all
44 workshops, 35 speakers, 160 tracks, and 135 file records. It found no mismatch
in the fields compared: workshop text, dates, location, publication/registration
flags, tags, original image reference, tracks and speaker links; speaker fields;
file IDs, workshop links, titles, names, types and calculated destination paths.
Standalone track fields also matched the embedded export tracks.

That comparison validates transfer of exported values. It does **not** prove
the source is historically correct or that calculated asset paths identify the
right media. Dates were compared using the development machine's local timezone,
matching the importer; Linux timezone behavior has not been audited here.

Across all current workshops, the audit found one shared folder: `workshop043`.
The pre-import ownership comparison found the same one conflict.

## Remaining media issues

The initial audit counted 75 imported references without files at their calculated
Contents paths: 19 materials/photos and 56 image records. The subsequent online
recovery resolved 71 of these. The [current media review](data-import-assets.md)
lists the four remaining source 404s and external-poster verification limits.

The initial guard checked folder ownership before its first write and rejected both
a different owner of a destination folder and an attempt to move an existing
event merely because its chronological position changed. The final stable-ID
mapping and explicit repair mode preserve those ownership checks while allowing
the reviewed separation of March 5 from Test.

The root Release solution build passed without warnings/errors, and all 13
migration mapping tests passed, including export reordering, explicit repair,
destination ownership, path traversal and recovered-file mapping. The full
backend suite passed 852 tests. No frontend code changed. The prior frontend
gate timeout remains a verification gap; no app restart was performed.
The Windows publish verification passed with all 42 existing SPA assets matching
the build and historical assets preserved. Both applications also published for
Linux x64; all 111 verified imported media hashes matched in both website publish
artifacts. Linux hosts were not executed.
