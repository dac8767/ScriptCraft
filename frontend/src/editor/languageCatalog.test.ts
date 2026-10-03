import { describe, it, expect } from 'vitest';
import { BUILTIN, CATALOG, urlsFor } from './languageCatalog';

/* v7.96 (app-health hardening): a dictionary download must name an exact
   version or commit, so what users fetch cannot change without a change here. */
describe('dictionary downloads are pinned', () => {
  const langs = [BUILTIN, ...CATALOG];

  it('every jsDelivr package carries an exact x.y.z version', () => {
    for (const lang of langs.filter((l) => l.source.kind === 'jsdelivr')) {
      const { aff, dic } = urlsFor(lang);
      for (const u of [aff, dic]) expect(u, lang.code).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\/[a-z-]+@\d+\.\d+\.\d+\/index\.(aff|dic)$/);
    }
  });

  it('every LibreOffice download names a commit, never a branch', () => {
    for (const lang of langs.filter((l) => l.source.kind === 'libreoffice')) {
      const { aff, dic } = urlsFor(lang);
      for (const u of [aff, dic]) expect(u, lang.code).toMatch(/^https:\/\/raw\.githubusercontent\.com\/LibreOffice\/dictionaries\/[0-9a-f]{40}\//);
    }
  });
});
