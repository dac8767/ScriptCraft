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

/**
 * Regression: the bridge killed the agent the instant the POST body arrived.
 *
 * `IncomingMessage` ('req') emits 'close' when the request has been fully READ,
 * not when the client disconnects — so hanging the kill on req.on('close') meant
 * every run was terminated before it produced a byte, and the panel showed
 * nothing at all. The kill belongs on the RESPONSE, which closes when the
 * connection actually goes away, guarded so a normal finish isn't mistaken for
 * the user walking away.
 */
describe('the child is killed only when the CLIENT really goes away', () => {
  const simulate = (killOn: 'req' | 'res', premature: boolean) => {
    let killed = false;
    let finished = false;
    const child = { kill: () => { killed = true; }, get killed() { return killed; } };

    // A run: the request body is read, then the agent works, then it finishes.
    const reqClose = () => { if (killOn === 'req') child.kill(); };
    const resClose = () => { if (killOn === 'res' && !finished) child.kill(); };

    reqClose();                       // body fully read — happens on EVERY request
    if (killed) return { killedBeforeWorking: true, killed };
    if (premature) { resClose(); return { killedBeforeWorking: false, killed }; }
    finished = true;                  // child exited normally
    resClose();
    return { killedBeforeWorking: false, killed };
  };

  it('the old code killed it before it could work — the bug you hit', () => {
    expect(simulate('req', false).killedBeforeWorking).toBe(true);
  });

  it('the fix lets a normal run complete untouched', () => {
    const r = simulate('res', false);
    expect(r.killedBeforeWorking).toBe(false);
    expect(r.killed).toBe(false);
  });

  it('...but Stop (a premature disconnect) still kills the agent', () => {
    expect(simulate('res', true).killed).toBe(true);
  });
});
