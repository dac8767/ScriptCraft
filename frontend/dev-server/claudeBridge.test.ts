import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { resolveClaude } from './claudeBridge';

const home = os.homedir();
const nativePath = path.join(home, '.local/bin/claude');

describe('resolveClaude — finding the CLI without trusting PATH', () => {
  it('finds the native install, which is exactly the case that failed', () => {
    // Derek's situation: installed at ~/.local/bin, but the dev server's PATH
    // never saw it because Tauri spawns a non-interactive shell.
    const onlyNative = (p: string) => p === nativePath;
    expect(resolveClaude(onlyNative)).toBe(nativePath);
  });

  it('finds a homebrew install on Apple silicon', () => {
    expect(resolveClaude((p) => p === '/opt/homebrew/bin/claude')).toBe('/opt/homebrew/bin/claude');
  });

  it('finds a user-prefixed npm install', () => {
    const npmPath = path.join(home, '.npm-global/bin/claude');
    expect(resolveClaude((p) => p === npmPath)).toBe(npmPath);
  });

  it('an explicit CLAUDE_BIN override beats everything', () => {
    process.env.CLAUDE_BIN = '/custom/claude';
    expect(resolveClaude((p) => p === '/custom/claude' || p === nativePath)).toBe('/custom/claude');
    delete process.env.CLAUDE_BIN;
  });

  it('prefers the native install over homebrew when both exist', () => {
    expect(resolveClaude(() => true)).toBe(nativePath);
  });
});
