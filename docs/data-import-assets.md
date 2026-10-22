# Online media verification — 2026-10-22

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
