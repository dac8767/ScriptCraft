import { describe, it, expect } from 'vitest';
import { parseStreamLine, feed } from './claudeClient';

describe('claudeClient — parsing Claude Code stream-json', () => {
  it('picks up the session id from the init event, so follow-ups resume', () => {
    const [e] = parseStreamLine(JSON.stringify({
      type: 'system', subtype: 'init', session_id: 'abc-123', tools: ['Read'],
    }));
    expect(e).toEqual({ kind: 'session', sessionId: 'abc-123' });
  });

  it('renders assistant text', () => {
    const evs = parseStreamLine(JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'The link is built in StickyCard.' }] },
    }));
    expect(evs).toEqual([{ kind: 'text', text: 'The link is built in StickyCard.' }]);
  });

  it('shows WHAT it is doing — which file, which command', () => {
    const evs = parseStreamLine(JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: '/Users/dcarl/FreeScript/frontend/src/dev/x.ts' } },
          { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
        ],
      },
    }));
    expect(evs).toEqual([
      { kind: 'tool', name: 'Read', detail: 'frontend/src/dev/x.ts' },  // path trimmed to the repo
      { kind: 'tool', name: 'Bash', detail: 'npm test' },
    ]);
  });

  it('carries the final result and its cost', () => {
    const [e] = parseStreamLine(JSON.stringify({
      type: 'result', subtype: 'success', result: 'Fixed.', total_cost_usd: 0.0421, session_id: 's1',
    }));
    expect(e).toEqual({ kind: 'result', text: 'Fixed.', cost: 0.0421, sessionId: 's1' });
  });

  it('surfaces bridge failures instead of hanging silently', () => {
    const [e] = parseStreamLine(JSON.stringify({
      type: 'bridge_error', message: 'Could not start the claude CLI: ENOENT',
    }));
    expect(e).toEqual({ kind: 'error', message: 'Could not start the claude CLI: ENOENT' });
  });

  it('ignores junk rather than throwing mid-stream', () => {
    expect(parseStreamLine('not json')).toEqual([]);
    expect(parseStreamLine('')).toEqual([]);
    expect(parseStreamLine(JSON.stringify({ type: 'user' }))).toEqual([]);
  });

  it('reassembles events split across network chunks', () => {
    // A stream can cut a JSON line in half; a naive split would drop it.
    const whole = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } });
    const a = whole.slice(0, 20);
    const b = whole.slice(20) + '\n';

    let buffer = '';
    const out: unknown[] = [];
    for (const chunk of [a, b]) {
      const { lines, rest } = feed(buffer, chunk);
      buffer = rest;
      for (const line of lines) out.push(...parseStreamLine(line));
    }
    expect(out).toEqual([{ kind: 'text', text: 'hello' }]);
  });
});
