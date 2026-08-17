/**
 * check-declared-deps — every package the build imports is DECLARED.
 *
 * v7.31: `vite.config.ts` did `await import('esbuild')` and esbuild was in no
 * package.json anywhere. It worked here and had worked for months, because
 * esbuild is a transitive dependency of vite and npm happened to hoist it to
 * the top of node_modules. Hoisting is not a contract. On Derek's machine
 * TypeScript could not resolve it and the build died at step one:
 *
 *     vite.config.ts:20 - error TS2307: Cannot find module 'esbuild'
 *
 * That is the worst shape a dependency bug takes: invisible to the person who
 * introduced it, and blocking for everyone else — the first thing he tried to
 * build with the new --local flag failed on something unrelated to it.
 *
 * This reads the BUILD-TIME configs (which run outside Vite's resolver, so
 * they get no help from it) and checks every bare import against the declared
 * dependencies.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..');

/* Config files, not src/. Anything under src/ goes through Vite's resolver
   and is covered by tsc + the build itself; these run before any of that. */
const CONFIGS = ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json']
  .map((f) => join(FRONTEND, f))
  .filter(existsSync);

const pkg = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);

/** node: builtins and relative paths are never dependencies. */
const isBare = (s) => !s.startsWith('.') && !s.startsWith('/') && !s.startsWith('node:');
/** '@scope/name/sub' → '@scope/name'; 'name/sub' → 'name'. */
const pkgName = (s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);

const BUILTINS = new Set(['fs', 'path', 'url', 'child_process', 'os', 'crypto', 'util', 'module']);

let fail = 0, checked = 0;
for (const file of CONFIGS) {
  const src = readFileSync(file, 'utf8');
  const specs = [
    ...[...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...src.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ].filter(isBare).map(pkgName).filter((n) => !BUILTINS.has(n));

  for (const name of new Set(specs)) {
    checked++;
    if (!declared.has(name)) {
      fail++;
      console.log(`  FAIL ${file.replace(FRONTEND, '.')} imports '${name}', which no package.json declares`);
      console.log('       It may resolve here by npm hoisting — that is luck, not a contract.');
      console.log(`       Fix: npm install --save-dev ${name}`);
    }
  }
}

console.log(fail
  ? `\ncheck-declared-deps: ${checked - fail} passed, ${fail} failed`
  : `\ncheck-declared-deps: ${checked} passed, 0 failed  (every build-config import is declared)`);
process.exit(fail ? 1 : 0);
