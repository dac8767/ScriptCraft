// check-brand — the brand sweep's guard (v7.15). Fails when a NEW OpenDraft or
// FreeDraft PROSE mention appears; identifiers, keys, domains and credentials
// are protected by name in devtools/brand-sweep.mjs, which this shells out to.
import { spawnSync } from 'node:child_process';
const r = spawnSync('node', [new URL('../../devtools/brand-sweep.mjs', import.meta.url).pathname, '--check'],
  { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status ?? 1);
