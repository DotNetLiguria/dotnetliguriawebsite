# Online media verification — 2026-10-22

## Speaker portrait provenance audit — 2026-10-23

The SQL export correctly assigns `/Uploads/speakers/3516c39[1].jpg` to Alberto
Baroni and `/Uploads/speakers/0334a91[1].jpg` to Andrea Sassetti. Commit
`0af1da7c085baf24cf3635c87ed4f9a104cb679f` (2026-01-10) copied these files to
the opposite named speaker destinations. Later moves preserved those exact bytes.
The October 22 record comparison checked the original URL fields but did not
verify these renamed portrait files. Name-based fallback exposed the swapped
assets; preferring Board portraits only masked the defect.

The new audit fetched the 20 nonempty exported speaker image URLs: 19 returned
images and one returned 404. Of the 17 matching named portraits already shipped,
15 exactly matched the live originals and two were the reciprocal swap above.
Those two named files now contain the correct original bytes. Alessandro
Melchiori's missing portrait and Guido Noceti's missing source placeholder are
also shipped under their matching names. No database writes were performed.

`DataMigration/json/speakerAssetSources.json` binds all 19 available images to
the source speaker ID, name, original path, online URL, destination and SHA256.
`scripts/verify-speaker-assets.ps1` checks these bindings and file hashes in the
shared gate, local import helper and publish verification. The importer performs
its own validation before database access and uses the verified destination
instead of leaving a non-served legacy URL in `ProfileImageUrl`.

The expanded publish check also exposed missing publish-copy metadata on the
portrait content items. Both `Contents/profile` and `Contents/speakers` now copy
to build/publish output, and publish verification checks every file in both
folders against its source bytes, in addition to the 19 online-verified mappings.

Andrea Baresi's `/Uploads/speakers/download.jpg` returns 404. The other 15 speaker
records have no source photo URL. The importer maps these to a null image URL;
independent managed photo choices remain unchanged.
All 44 original event pages were rechecked with zero differences in the fields
covered by the prior event audit. Rechecking the saved October 22 database
snapshot still matched 2,753 source/mapping values; this was not a new live
database audit and does not certify all fields or all media.

The older event-media audit and its limitations follow below.

The live website supplied 40 original event posters and recovered 71 of the
75 initially missing exported file references. All 111 new files are stored
under Contents/imported with ID-based paths; their source URLs and SHA256 hashes
are recorded in [the provenance manifest](../src/dotnetliguriawebsite/DataMigration/json/workshopAssetSources.json).
The running backend served all 111 files with matching SHA256 hashes. Historical
assets and the Test event image were not overwritten.

## Remaining original URLs returning 404

These four database records are retained as exported metadata. The importer
does not fabricate replacements. Recover the originals from another backup or
review the references before production.

| Export file ID | Original source path |
| --- | --- |
| 39dfac03-e0ce-4b8b-80c8-2c40ac2591c3 | /Uploads/workshops/af37706a-0be1-497e-9c27-f1bad19f5aeb/IMG_20140225_081831.jpg |
| 21611d89-02c7-4acb-9366-a0bd72a99995 | /Uploads/workshops/399be155-60a5-4787-9ea6-3ea8be704dd0/Anotnio-Conte.png |
| a88af96d-13d4-46cd-a47c-d474e0de380e | /Uploads/workshops/af37706a-0be1-497e-9c27-f1bad19f5aeb/avatar.jpg |
| 1dbb5061-229c-45cf-bdb7-f181ffbdd1e1 | /Uploads/workshops/168f890d-1d05-4d95-9b2e-47d3f25634a9/20251212-dotnetconf-liguria-part-1[1].pdf |

## Posters hosted outside dotnetliguria.net

These four events reference third-party image hosts. Their existing historical
local posters are retained; their original source bytes were not verified.

| Workshop ID | Original image URL |
| --- | --- |
| 1f897fb5-4870-4769-a2d7-c2149049793a | http://www.plaffo.com/wp/wp-content/uploads/2012/09/MDC.png |
| d4a675b7-e631-4201-a55e-8778e2d8edf2 | http://www.w3.org/html/logo/downloads/HTML5_Badge_512.png |
| 96915916-61ef-4a96-aaa9-dcd6a6670a6c | https://miapple.me/wp-content/uploads/2013/07/Windows-8.1-Logo.jpg |
| 399be155-60a5-4787-9ea6-3ea8be704dd0 | http://www.ordineingegneri.genova.it/images/leonardo.png |

## Other verification limits

The export references one original archive larger than the online audit's 64 MiB
download cap. Its URL responded successfully and the existing local archive is
retained; its bytes were not newly compared with that online original. Existing
non-recovered legacy media were not overwritten or re-certified by file hash.
