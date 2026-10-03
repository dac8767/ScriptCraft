/** Catalog of languages users can install. Entries come from two sources:
 *
 *  - jsdelivr (wooorm/dictionaries): most European languages.
 *  - LibreOffice/dictionaries (raw.githubusercontent.com): the Indian language
 *    set (Hindi, Tamil, Telugu, etc.), Arabic, and a few others not in wooorm.
 *
 *  The installer also accepts arbitrary URLs via a "Custom URL…" entry. */

export interface CatalogLanguage {
  /** Internal code (becomes the spell-checker language id). */
  code: string;
  /** User-facing label, e.g. "Hindi (हिन्दी)". */
  label: string;
  /** Native script sample (for the picker). */
  sample?: string;
  /** Where to download from. */
  source:
    | { kind: 'jsdelivr'; npm: string; version: string }
    | { kind: 'libreoffice'; folder: string; baseName?: string }
    /** Hunspell files committed to this repo under `dictionaries-extra/<path>/`
     *  and served via jsDelivr's GitHub CDN. Used for languages where the
     *  upstream LibreOffice / wooorm dictionary is too small or unavailable
     *  (e.g. Odia — LibreOffice ships 1k words; we ship a 320k-word list
     *  derived from the MPL-2.0 Odia Spelling Checker Firefox add-on). */
    | { kind: 'opendraft-extra'; path: string };
}

/** Built-in language always available; not downloadable. */
export const BUILTIN: CatalogLanguage = {
  code: 'en_US',
  label: 'English (US)',
  source: { kind: 'jsdelivr', npm: 'dictionary-en-us', version: '2.2.1' },
  sample: 'Aa',
};

/** Languages the user can install. */
export const CATALOG: CatalogLanguage[] = [
  // English variants (wooorm)
  { code: 'en_GB', label: 'English (UK)', source: { kind: 'jsdelivr', npm: 'dictionary-en-gb', version: '3.0.0' }, sample: 'Aa' },
  { code: 'en_AU', label: 'English (Australia)', source: { kind: 'jsdelivr', npm: 'dictionary-en-au', version: '3.0.0' }, sample: 'Aa' },
  { code: 'en_CA', label: 'English (Canada)', source: { kind: 'jsdelivr', npm: 'dictionary-en-ca', version: '3.0.0' }, sample: 'Aa' },

  // Indic languages (LibreOffice)
  { code: 'hi_IN', label: 'Hindi (हिन्दी)', source: { kind: 'libreoffice', folder: 'hi_IN' }, sample: 'क ख' },
  { code: 'mr_IN', label: 'Marathi (मराठी)', source: { kind: 'libreoffice', folder: 'mr_IN' }, sample: 'क ख' },
  { code: 'gu_IN', label: 'Gujarati (ગુજરાતી)', source: { kind: 'libreoffice', folder: 'gu_IN' }, sample: 'ક ખ' },
  { code: 'bn_BD', label: 'Bengali (বাংলা)', source: { kind: 'libreoffice', folder: 'bn_BD' }, sample: 'ক খ' },
  { code: 'ta_IN', label: 'Tamil (தமிழ்)', source: { kind: 'libreoffice', folder: 'ta_IN' }, sample: 'அ ஆ' },
  { code: 'te_IN', label: 'Telugu (తెలుగు)', source: { kind: 'libreoffice', folder: 'te_IN' }, sample: 'అ ఆ' },
  { code: 'kn_IN', label: 'Kannada (ಕನ್ನಡ)', source: { kind: 'libreoffice', folder: 'kn_IN' }, sample: 'ಅ ಆ' },
  { code: 'pa_IN', label: 'Punjabi (ਪੰਜਾਬੀ)', source: { kind: 'libreoffice', folder: 'pa_IN' }, sample: 'ੳ ਅ' },
  // LibreOffice's or_IN ships only ~1k words, so basic Odia gets flagged as
  // misspelled. We use a 320k-word list derived from the Odia Wikipedians'
  // Firefox add-on (MPL-2.0). See dictionaries-extra/or_IN/NOTICE.md.
  { code: 'or_IN', label: 'Odia (ଓଡ଼ିଆ)', source: { kind: 'opendraft-extra', path: 'or_IN' }, sample: 'ଅ ଆ' },
  { code: 'as_IN', label: 'Assamese (অসমীয়া)', source: { kind: 'libreoffice', folder: 'as_IN' }, sample: 'অ আ' },
  { code: 'ne_NP', label: 'Nepali (नेपाली)', source: { kind: 'libreoffice', folder: 'ne_NP' }, sample: 'क ख' },
  { code: 'si_LK', label: 'Sinhala (සිංහල)', source: { kind: 'libreoffice', folder: 'si_LK' }, sample: 'අ ආ' },

  // European (wooorm)
  { code: 'fr', label: 'French (Français)', source: { kind: 'jsdelivr', npm: 'dictionary-fr', version: '3.0.0' }, sample: 'Àà' },
  { code: 'de', label: 'German (Deutsch)', source: { kind: 'jsdelivr', npm: 'dictionary-de', version: '3.0.0' }, sample: 'Ää' },
  { code: 'es', label: 'Spanish (Español)', source: { kind: 'jsdelivr', npm: 'dictionary-es', version: '4.0.0' }, sample: 'Ññ' },
  { code: 'it', label: 'Italian (Italiano)', source: { kind: 'jsdelivr', npm: 'dictionary-it', version: '2.0.0' }, sample: 'Èè' },
  { code: 'pt', label: 'Portuguese', source: { kind: 'jsdelivr', npm: 'dictionary-pt', version: '4.0.0' }, sample: 'Ãã' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)', source: { kind: 'jsdelivr', npm: 'dictionary-pt-br', version: '2.0.1' }, sample: 'Ãã' },
  { code: 'pt_PT', label: 'Portuguese (Portugal)', source: { kind: 'jsdelivr', npm: 'dictionary-pt-pt', version: '2.0.0' }, sample: 'Ãã' },
  { code: 'nl', label: 'Dutch (Nederlands)', source: { kind: 'jsdelivr', npm: 'dictionary-nl', version: '2.0.0' }, sample: 'Ïï' },
  { code: 'ru', label: 'Russian (Русский)', source: { kind: 'jsdelivr', npm: 'dictionary-ru', version: '3.0.0' }, sample: 'Аа' },
  { code: 'pl', label: 'Polish (Polski)', source: { kind: 'jsdelivr', npm: 'dictionary-pl', version: '2.0.0' }, sample: 'Łł' },
  { code: 'tr', label: 'Turkish (Türkçe)', source: { kind: 'jsdelivr', npm: 'dictionary-tr', version: '2.0.0' }, sample: 'Şş' },

  // Other (LibreOffice for Arabic; wooorm for the rest)
  { code: 'ar', label: 'Arabic (العربية)', source: { kind: 'libreoffice', folder: 'ar' }, sample: 'ا ب' },
  { code: 'fa', label: 'Persian (فارسی)', source: { kind: 'jsdelivr', npm: 'dictionary-fa', version: '2.0.0' }, sample: 'ا ب' },
  { code: 'he', label: 'Hebrew (עברית)', source: { kind: 'jsdelivr', npm: 'dictionary-he', version: '2.0.0' }, sample: 'א ב' },
];

const ALL_BY_CODE = new Map<string, CatalogLanguage>(
  [BUILTIN, ...CATALOG].map((l) => [l.code, l]),
);

export function findLanguage(code: string): CatalogLanguage | undefined {
  return ALL_BY_CODE.get(code);
}

/** Where the `opendraft-extra` dictionaries live. SHIPPED WITH THE APP, in
 *  frontend/public/dictionaries-extra/ — the same way en_US already works.
 *
 *  v7.36 pointed this at jsDelivr, reading our own repo, to get off Proteus's
 *  CDN. v7.67: that URL has been 404ing the whole time. jsDelivr's `/gh/`
 *  endpoint serves PUBLIC repositories only and this repo is private, so Odia
 *  spell-check silently did nothing — a download that fails is indistinguishable
 *  from a language nobody selected. Neither sandbox that touched that line
 *  could reach jsDelivr to notice; GitHub's own settings page is what finally
 *  said so.
 *
 *  The obvious repair was to make the repo public. That publishes the entire
 *  commercial source to serve one dictionary, and GitHub blocks it anyway
 *  (visibility cannot be changed on a fork). Bundling costs 7.6 MB in the
 *  .dmg and removes the network from the path entirely — no CDN, no repo
 *  visibility, and it works offline, which for a spell-checker is the right
 *  behaviour regardless.
 *
 *  Still not switched to LibreOffice, which also publishes or_IN: theirs is
 *  1,030 words against this list's 321,831, so "remove the dependency" that
 *  way would quietly gut Odia spell-check.
 *
 *  dictionaries-extra/or_IN/ at the repo root stays as the source of record
 *  (it carries the MPL-2.0 NOTICE.md); public/ holds the shipped copy.
 *  check-v767 fails if the two drift apart. */
const OPENDRAFT_EXTRA_BASE = '/dictionaries-extra';

/** v7.96 (app-health hardening): every downloaded dictionary is PINNED.
 *  Unpinned, `npm/<pkg>` and LibreOffice `master` meant whatever was published
 *  next is what a user downloaded — a changed or hijacked upstream would reach
 *  every new install with no change here. Pinned to exactly what was being
 *  served on 2026-10-02 (byte-identical, checked per file). Note jsDelivr's
 *  unpinned URL is NOT npm "latest" for deprecated packages — dictionary-en-us
 *  and dictionary-pt-br resolve to 2.2.1 / 2.0.1, and their 3.0.0 has no
 *  index.aff at all. Bump deliberately, and re-check the files exist. */
const LIBREOFFICE_REF = '32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4'; // master, 2026-08-22

/** Build .aff/.dic download URLs for a catalog entry. */
export function urlsFor(lang: CatalogLanguage): { aff: string; dic: string } {
  if (lang.source.kind === 'jsdelivr') {
    return {
      aff: `https://cdn.jsdelivr.net/npm/${lang.source.npm}@${lang.source.version}/index.aff`,
      dic: `https://cdn.jsdelivr.net/npm/${lang.source.npm}@${lang.source.version}/index.dic`,
    };
  }
  if (lang.source.kind === 'opendraft-extra') {
    const dir = lang.source.path;
    // The on-disk files use the language code as their basename.
    return {
      aff: `${OPENDRAFT_EXTRA_BASE}/${dir}/${lang.code}.aff`,
      dic: `${OPENDRAFT_EXTRA_BASE}/${dir}/${lang.code}.dic`,
    };
  }
  const { folder, baseName } = lang.source;
  const name = baseName || folder;
  const base = `https://raw.githubusercontent.com/LibreOffice/dictionaries/${LIBREOFFICE_REF}/${folder}/${name}`;
  return { aff: `${base}.aff`, dic: `${base}.dic` };
}

