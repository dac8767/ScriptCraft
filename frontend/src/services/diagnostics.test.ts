// @vitest-environment jsdom
/**
 * diagnostics (v7.63) — the report has to name the build it was collected on.
 *
 * It did not. getAppVersion() preferred a `window.__OPENDRAFT_VERSION__` that
 * nothing in this app has ever assigned, and fell back to the literal '0.19.0'
 * — the version this was forked from. So the single artifact whose entire
 * purpose is answering "which build are you running" answered with the fork's
 * number, to every tester, with no sign anything was wrong.
 *
 * check-version-sync asserts the SOURCE no longer hard-codes a version. This
 * asserts the OUTPUT, which is the thing a tester actually pastes — the source
 * check would pass just as happily if the value were read and then dropped.
 */
import { describe, it, expect } from 'vitest';
import { collectDiagnostics, formatReport } from './diagnostics';
import { APP_VERSION } from '../data/changelog';

describe('diagnostics report version', () => {
  it('carries the running app version, not the forked-from default', async () => {
    const report = await collectDiagnostics();
    expect(report.appVersion).toBe(APP_VERSION);
    expect(report.appVersion).not.toBe('0.19.0');
  });

  it('and prints it in the text a tester pastes into a bug report', async () => {
    const text = formatReport(await collectDiagnostics());
    expect(text).toContain(`Version: ${APP_VERSION}`);
    expect(text).not.toContain('0.19.0');
  });
});
