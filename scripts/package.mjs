/**
 * Builds the handoff archive for the developer who ships the site.
 *
 *   pnpm package                 -> talaria-flow-<yyyy-mm-dd>-<sha>.zip in the repo root
 *   pnpm package -- --allow-dirty  (skip the clean-working-tree check)
 *
 * The archive is `git archive` of HEAD: tracked files only, so secrets (.env), node_modules, test
 * artefacts, agent tooling and earlier zips never end up inside. Generated assets are produced on
 * Vercel by `pnpm build` (see vercel.json), so they are intentionally not part of the archive.
 * Before archiving the script runs the same gate as CI: build, CSP hashes, typecheck, unit tests.
 */
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowDirty = process.argv.includes('--allow-dirty');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
}

const dirty = run('git status --porcelain', { quiet: true }).trim();
if (dirty && !allowDirty) {
  console.error('Working tree is not clean; commit first or pass --allow-dirty (uncommitted changes are NOT archived):\n' + dirty);
  process.exit(1);
}

run('node scripts/build.mjs');
run('node scripts/csp-hashes.mjs');
run('npx tsc -p tsconfig.json');
run('node --test "tests/unit/**/*.test.mjs"');

const sha = run('git rev-parse --short HEAD', { quiet: true }).trim();
const date = new Date().toISOString().slice(0, 10);
const name = `talaria-flow-${date}-${sha}.zip`;
run(`git archive --format=zip --prefix=talaria-flow/ -o "${name}" HEAD`);

const out = resolve(root, name);
if (!existsSync(out)) {
  console.error('Archive was not created');
  process.exit(1);
}
console.log(`\nPackaged ${name} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB) from ${sha}`);
console.log('Ship with: unzip -> pnpm install --frozen-lockfile -> fill .env from .env.example -> vercel deploy (see DEPLOY.md)');
