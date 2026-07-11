/**
 * claudeBridge — a DEV-ONLY Vite middleware that runs Claude Code in this repo
 * and streams the result back to the Dev Picker panel.
 *
 * Why this shape:
 *   - The Vite dev server is a Node process running on your Mac, in your repo.
 *     It can already spawn processes. So the bridge needs no Rust, no Cargo
 *     change, and no API key — and it CANNOT exist in a production build, because
 *     `apply: 'serve'` means it only ever loads under `vite dev`.
 *   - It runs the `claude` CLI in headless mode (`-p`), which is the same agent as
 *     the terminal: it reads files, greps, runs commands, edits code. That's the
 *     difference that matters. An in-app chat against the raw API would have no
 *     repo and no tools — it could talk about the bug but not find it.
 *
 * Safety, deliberately conservative:
 *   - READ-ONLY by default. Claude can look, not touch. Edits require you to tick
 *     "Allow edits", which is per-request, not a stored setting.
 *   - No --dangerously-skip-permissions, ever.
 *   - Bounded: --max-turns and a hard timeout, so a confused run can't grind on.
 *   - The child is killed if you hit Stop or close the panel.
 */
import type { Plugin } from 'vite';
import { spawn, execFile, execFileSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Find the claude binary WITHOUT trusting the inherited PATH.
 *
 * The first version just ran `claude` and let PATH resolve it. That works in your
 * terminal and fails here: Tauri spawns the dev server through a NON-INTERACTIVE
 * shell, which never sources ~/.zshrc — so the `export PATH=$HOME/.local/bin` the
 * installer added is simply not in this process's environment. The CLI was
 * installed and working, and the bridge still reported it missing.
 *
 * So: look where the installers actually put it, then, failing that, ask a LOGIN
 * shell (which does read your rc files) where it lives.
 */
export function resolveClaude(
  exists: (p: string) => boolean = fs.existsSync,
): string | null {
  const home = os.homedir();
  const candidates = [
    process.env.CLAUDE_BIN,                        // explicit override wins
    path.join(home, '.local/bin/claude'),          // native installer
    '/opt/homebrew/bin/claude',                    // homebrew, Apple silicon
    '/usr/local/bin/claude',                       // homebrew, Intel / npm
    path.join(home, '.npm-global/bin/claude'),     // user-prefixed npm
  ].filter(Boolean) as string[];

  for (const c of candidates) if (exists(c)) return c;

  // Last resort: a login shell knows what your terminal knows.
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const found = execFileSync(shell, ['-lic', 'command -v claude'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').pop()?.trim();
    if (found && exists(found)) return found;
  } catch { /* not there */ }

  return null;
}

/** Look but don't touch: enough to diagnose, not enough to change anything. */
const READ_ONLY_TOOLS = [
  'Read', 'Grep', 'Glob',
  'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git status:*)',
  'Bash(npx tsc:*)', 'Bash(npm test:*)',
].join(',');

/** With edits allowed, it can also write — and run the verification gates. */
const EDIT_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'].join(',');

const SYSTEM = [
  'You are working inside FreeDraft, a screenwriting desktop app (React 19 + ',
  'TypeScript + Vite frontend, TipTap editor, Tauri shell).',
  'The user is talking to you from a Dev Picker panel INSIDE the running app, so ',
  'names like "Notes — Right Panel" or "toolbar key: bold" refer to real UI ',
  'elements and registry ids — take them literally.',
  'Diagnose root causes rather than patching symptoms. If you change code, run ',
  'the verification gates before you claim it works: `npx tsc -b` (expect the ',
  'existing baseline of unused-var errors, no new ones) and `npm test`.',
  'Be concise: the panel is narrow.',
].join('');

export function claudeBridge(): Plugin {
  const repoRoot = path.resolve(process.cwd(), '..');
  const running = new Set<ChildProcess>();

  return {
    name: 'dev-claude-bridge',
    apply: 'serve',            // dev server only — never in a build

    configureServer(server) {
      // Is the CLI even installed and authed?
      server.middlewares.use('/__dev/claude/status', (_req, res) => {
        const bin = resolveClaude();
        res.setHeader('Content-Type', 'application/json');
        if (!bin) {
          res.end(JSON.stringify({
            available: false,
            hint: 'Claude Code CLI not found. Install: curl -fsSL https://claude.ai/install.sh | bash — then restart tauri dev.',
          }));
          return;
        }
        execFile(bin, ['--version'], { timeout: 8000 }, (err, stdout) => {
          res.end(JSON.stringify(err
            ? { available: false, hint: `Found ${bin} but it failed to run: ${err.message}` }
            : { available: true, version: String(stdout).trim(), bin, cwd: repoRoot }));
        });
      });

      // git diff --stat, so you can see what a run actually touched.
      server.middlewares.use('/__dev/claude/diff', (_req, res) => {
        execFile('git', ['diff', '--stat'], { cwd: repoRoot, timeout: 10000 }, (err, stdout) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ diff: err ? '' : String(stdout).trim() }));
        });
      });

      server.middlewares.use('/__dev/claude/run', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          let prompt = '', sessionId: string | undefined, allowEdits = false;
          try {
            const j = JSON.parse(body || '{}');
            prompt = String(j.prompt || '').trim();
            sessionId = j.sessionId || undefined;
            allowEdits = !!j.allowEdits;
          } catch { /* fall through to the empty-prompt guard */ }

          if (!prompt) { res.statusCode = 400; res.end('empty prompt'); return; }

          const args = [
            '-p', prompt,
            '--output-format', 'stream-json',
            '--verbose',                       // stream-json needs it for events
            '--max-turns', allowEdits ? '30' : '12',
            '--allowedTools', allowEdits ? EDIT_TOOLS : READ_ONLY_TOOLS,
            '--append-system-prompt', SYSTEM,
          ];
          if (allowEdits) args.push('--permission-mode', 'acceptEdits');
          if (sessionId) args.push('--resume', sessionId);

          const bin = resolveClaude();
          if (!bin) {
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.write(JSON.stringify({
              type: 'bridge_error',
              message: 'Claude Code CLI not found. Install: curl -fsSL https://claude.ai/install.sh | bash — then restart tauri dev.',
            }) + '\n');
            res.end();
            return;
          }

          // The child gets a PATH containing the CLI's own directory, so any tool
          // it shells out to (git, node, npx) resolves the same way it would in
          // your terminal.
          const child = spawn(bin, args, {
            cwd: repoRoot,
            env: {
              ...process.env,
              PATH: [
                path.dirname(bin),
                path.join(os.homedir(), '.local/bin'),
                '/opt/homebrew/bin',
                '/usr/local/bin',
                process.env.PATH ?? '',
              ].join(':'),
            },
          });
          running.add(child);

          res.setHeader('Content-Type', 'application/x-ndjson');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('X-Accel-Buffering', 'no');

          // A confused run shouldn't be able to grind forever.
          const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            res.write(JSON.stringify({ type: 'bridge_error', message: 'Timed out after 10 minutes.' }) + '\n');
          }, 10 * 60 * 1000);

          child.stdout.on('data', (chunk) => res.write(chunk));
          child.stderr.on('data', (chunk) => {
            res.write(JSON.stringify({ type: 'bridge_stderr', message: String(chunk) }) + '\n');
          });
          child.on('error', (err) => {
            res.write(JSON.stringify({
              type: 'bridge_error',
              message: `Could not start the claude CLI: ${err.message}`,
            }) + '\n');
          });
          let finished = false;
          child.on('close', (code) => {
            finished = true;
            clearTimeout(timeout);
            running.delete(child);
            res.write(JSON.stringify({ type: 'bridge_done', code }) + '\n');
            res.end();
          });

          /**
           * Kill the agent if the CLIENT goes away — Stop, or closing the panel.
           *
           * This was on req.on('close'), which is wrong and was THE bug: in modern
           * Node, IncomingMessage emits 'close' as soon as the request body has
           * been fully read, not when the client disconnects. So the instant the
           * POST body arrived, the agent was killed — before it produced a single
           * byte. That's why sending a message did nothing at all.
           *
           * res.on('close') fires when the connection actually closes. It also
           * fires on a NORMAL finish, hence the `finished` guard: only a premature
           * close means the user walked away.
           */
          res.on('close', () => {
            if (!finished && !child.killed) child.kill('SIGTERM');
            clearTimeout(timeout);
          });
        });
      });

      server.httpServer?.on('close', () => {
        for (const c of running) c.kill('SIGTERM');
      });
    },
  };
}
