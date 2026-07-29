ScriptCraft Thesaurus data (v5.53)
==================================

th_en_US_v2.dat — the MyThes English (US) thesaurus, the dataset shipped by
OpenOffice.org and LibreOffice (lingucomponent project), derived from
Princeton University's WordNet. Fetched verbatim from the LibreOffice
dictionaries repository (github.com/LibreOffice/dictionaries, en/).

Format: line 1 names the encoding (UTF-8); then repeating blocks of a head
line `word|senseCount` followed by senseCount lines `(pos)|synonym|…`.
Synonyms may carry a qualifier suffix: (generic term), (similar term),
(related term), or (antonym). ~146k head words. The app parses this file
locally (frontend/src/utils/thesaurus.ts) — no network is involved.

Licenses (shipped alongside, verbatim from upstream):
- WordNet_license.txt — the Princeton WordNet 2.1 license for the data.
- license.txt — the LibreOffice en-dictionaries license collection.

The index file (th_en_US_v2.idx) upstream generates at build time is not
needed — the app derives the index from the .dat in one pass at load.
