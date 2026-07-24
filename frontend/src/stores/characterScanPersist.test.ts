// @vitest-environment jsdom
/**
 * v4.24 (Derek batch 1-2): the From Script scan list and the classify-referred
 * tags ride in the script file (_referredTags / _characterScan in the save
 * payload) and survive a relaunch. Root cause of the old bug: referredTags
 * were only mirrored through collabSync's Yjs map, which never runs in
 * Local-only mode — every classification vanished on restart. Now they
 * persist exactly like character profiles do: composed into every save,
 * restored on every load.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { composeSaveContent } from '../utils/screenplaySaveContent';

const S = () => useEditorStore.getState();

beforeEach(() => {
  S().setReferredTags({});
  S().setScanResults(null);
});

describe('From Script scan/classify persistence via the save payload', () => {
  it('composeSaveContent carries the scan list and the referred tags', () => {
    S().setScanResults([{ name: 'SARAH', description: 'sharp', age: '30s', source: 'cue' }]);
    S().setReferredTag('NIGHTFALL', { kind: 'other' });
    S().setReferredTag('REEVES', { kind: 'character', character: 'SARAH' });

    const out = composeSaveContent({ type: 'doc', content: [] });
    expect(out._characterScan).toEqual([{ name: 'SARAH', description: 'sharp', age: '30s', source: 'cue' }]);
    expect(out._referredTags).toEqual({
      NIGHTFALL: { kind: 'other' },
      REEVES: { kind: 'character', character: 'SARAH' },
    });
  });

  it('survives a simulated relaunch: save → clear (script switch) → restore', () => {
    S().setScanResults([{ name: 'SARAH', description: 'sharp', age: '30s', source: 'cue' }]);
    S().setReferredTag('NIGHTFALL', { kind: 'other' });
    const saved = composeSaveContent({ type: 'doc', content: [] });

    // What every load path does before restoring: wipe per-script state.
    S().setReferredTags({});
    S().setScanResults(null);
    expect(S().referredTags).toEqual({});
    expect(S().scanResults).toBeNull();

    // ...then restore from the saved payload (same shape the load paths read).
    S().setReferredTags(saved._referredTags as Record<string, import('./editorStore').ReferredTag>);
    S().setScanResults(saved._characterScan as import('../utils/characterScan').ScannedCharacter[]);
    expect(S().referredTags).toEqual({ NIGHTFALL: { kind: 'other' } });
    expect(S().scanResults).toEqual([{ name: 'SARAH', description: 'sharp', age: '30s', source: 'cue' }]);
  });

  it('setReferredTag merges rather than replaces', () => {
    S().setReferredTag('A', { kind: 'other' });
    S().setReferredTag('B', { kind: 'location' });
    expect(Object.keys(S().referredTags).sort()).toEqual(['A', 'B']);
  });
});
