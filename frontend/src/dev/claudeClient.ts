/**
 * claudeClient — talks to the dev-only bridge (see frontend/dev-server/).
 *
 * The parsing is kept as pure functions so it can be tested without a server:
 * Claude Code's stream-json is a line of JSON per event, and the shape of those
 * events is the one thing here that could silently change under us.
 */

/** What the panel actually renders. */
export type PanelEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'result'; text: string; cost?: number; sessionId?: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; code: number | null };

/** Turn one NDJSON line from `claude --output-format stream-json` into an event. */
export function parseStreamLine(line: string): PanelEvent[] {
  const t = line.trim();
  if (!t) return [];
  let ev: Record<string, unknown>;
  try { ev = JSON.parse(t); } catch { return []; }

  const type = ev.type as string;

  if (type === 'bridge_error' || type === 'bridge_stderr') {
    return [{ kind: 'error', message: String(ev.message ?? 'unknown error') }];
  }
  if (type === 'bridge_done') {
    return [{ kind: 'done', code: (ev.code as number | null) ?? null }];
  }
  if (type === 'system' && ev.subtype === 'init') {
    return ev.session_id ? [{ kind: 'session', sessionId: String(ev.session_id) }] : [];
  }
  if (type === 'result') {
    return [{
      kind: 'result',
      text: String(ev.result ?? ''),
      cost: typeof ev.total_cost_usd === 'number' ? ev.total_cost_usd : undefined,
      sessionId: ev.session_id ? String(ev.session_id) : undefined,
    }];
  }
  if (type === 'assistant') {
    const msg = ev.message as { content?: unknown[] } | undefined;
    const out: PanelEvent[] = [];
    for (const block of msg?.content ?? []) {
      const b = block as Record<string, unknown>;
      if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        out.push({ kind: 'text', text: b.text });
      } else if (b.type === 'tool_use') {
        // Show WHAT it's doing — reading which file, running which command — so a
        // long run is legible rather than a spinner.
        const input = (b.input ?? {}) as Record<string, unknown>;
        const detail = String(
          input.file_path ?? input.pattern ?? input.command ?? input.path ?? '',
        ).replace(/^\/home\/claude\/FreeScript\/|^\/Users\/[^/]+\/FreeScript\//, '');
        out.push({ kind: 'tool', name: String(b.name ?? 'tool'), detail });
      }
    }
    return out;
  }
  return [];
}

/** Split a streamed chunk into complete lines, holding any partial tail. */
export function feed(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const all = buffer + chunk;
  const parts = all.split('\n');
  const rest = parts.pop() ?? '';        // last piece may be incomplete
  return { lines: parts, rest };
}

export async function checkBridge(): Promise<{ available: boolean; version?: string; hint?: string }> {
  try {
    const r = await fetch('/__dev/claude/status');
    return await r.json();
  } catch {
    return { available: false, hint: 'Dev bridge not reachable — is this a `tauri dev` / `vite dev` build?' };
  }
}

export async function gitDiffStat(): Promise<string> {
  try {
    const r = await fetch('/__dev/claude/diff');
    const j = await r.json();
    return j.diff || '';
  } catch { return ''; }
}

/** Run a prompt. Calls onEvent as things happen; resolves when the run ends. */
export async function runClaude(
  opts: { prompt: string; sessionId?: string; allowEdits: boolean; signal: AbortSignal },
  onEvent: (e: PanelEvent) => void,
): Promise<void> {
  const res = await fetch('/__dev/claude/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: opts.prompt,
      sessionId: opts.sessionId,
      allowEdits: opts.allowEdits,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    onEvent({ kind: 'error', message: `Bridge returned ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const { lines, rest } = feed(buffer, decoder.decode(value, { stream: true }));
    buffer = rest;
    for (const line of lines) for (const e of parseStreamLine(line)) onEvent(e);
  }
  for (const e of parseStreamLine(buffer)) onEvent(e);
}
