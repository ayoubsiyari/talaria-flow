/**
 * Prints the effective row-level-security state described by supabase/migrations/*.sql:
 * every table with RLS enabled and the policies that survive (create minus later drop).
 *
 *   node scripts/rls-report.mjs
 *
 * Static — it reads the SQL, it does not connect. Exit 1 if a table is created without
 * `enable row level security`, so a new table can never ship unprotected by accident.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');

const tables = new Set();
for (const m of sql.matchAll(/create table if not exists\s+([a-z_.]+)/gi)) tables.add(m[1].replace(/^public\./, ''));
for (const m of sql.matchAll(/drop table if exists\s+([a-z_.]+)/gi)) tables.delete(m[1].replace(/^public\./, ''));
const rls = new Set();
for (const m of sql.matchAll(/alter table\s+([a-z_.]+)\s+enable row level security/gi)) rls.add(m[1].replace(/^public\./, ''));

const policies = new Map();
const re = /(create|drop) policy(?: if exists)?\s+"([^"]+)"\s+on\s+([a-z_.]+)(?:\s+for\s+(select|insert|update|delete|all))?([\s\S]*?);/gi;
for (const m of sql.matchAll(re)) {
  const [, verb, name, tableRaw, cmd, rest] = m;
  const table = tableRaw.replace(/^public\./, '');
  const key = `${table}::${name}`;
  if (verb.toLowerCase() === 'drop') { policies.delete(key); continue; }
  const [usingPart, checkPart] = rest.split(/with check/i);
  const using = (usingPart.match(/using\s*\(([\s\S]*)\)\s*$/i) || [])[1];
  const check = checkPart ? (checkPart.match(/^\s*\(([\s\S]*)\)\s*$/) || [])[1] : '';
  policies.set(key, { table, name, cmd: (cmd || 'all').toUpperCase(), using: squash(using), check: squash(check) });
}
function squash(s) { return s ? s.replace(/\s+/g, ' ').trim() : ''; }

const byTable = new Map();
for (const p of policies.values()) {
  if (!byTable.has(p.table)) byTable.set(p.table, []);
  byTable.get(p.table).push(p);
}

let bad = false;
console.log('RLS policies (from supabase/migrations, in order):\n');
for (const table of [...tables].sort()) {
  const on = rls.has(table);
  if (!on) bad = true;
  console.log(`${table}  rls=${on ? 'ENABLED' : 'MISSING!'}`);
  for (const p of byTable.get(table) || []) {
    console.log(`  ${p.cmd.padEnd(6)} "${p.name}"`);
    if (p.using) console.log(`         using: ${p.using}`);
    if (p.check) console.log(`         check: ${p.check}`);
  }
  if (!(byTable.get(table) || []).length) console.log('  (no policies → only the service role can touch it)');
  console.log('');
}
console.log('storage.objects');
for (const p of byTable.get('storage.objects') || []) {
  console.log(`  ${p.cmd.padEnd(6)} "${p.name}"`);
  if (p.using) console.log(`         using: ${p.using}`);
  if (p.check) console.log(`         check: ${p.check}`);
}
if (bad) { console.error('\nA table is created without row level security.'); process.exit(1); }
