import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// No DATABASE_URL, host port, volume, or production endpoint is accepted.
// The fixture validates catalog SQL and read-only execution, NOT real RLS.
const container = `fitinerary-pr1a-audit-${process.pid}`;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 120_000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Docker failed');
  return result.stdout;
}
const psql = (sql) => docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], sql);
let started = false;
try {
  // A developer may have selected a remote Docker context. Refuse it before
  // starting any container; this verification is local-only.
  if (process.env.DOCKER_HOST) assert.match(process.env.DOCKER_HOST, /^(unix|npipe):\/\//, 'Remote Docker host forbidden');
  assert.match(docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim(), /^(unix|npipe):\/\//, 'Remote Docker context forbidden');
  docker(['run', '--detach', '--rm', '--name', container,
    '--env', 'POSTGRES_PASSWORD=local-fixture-only',
    '--tmpfs', '/var/lib/postgresql/data', 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      ready = true;
      break;
    } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  assert.ok(ready, 'Local PostgreSQL did not become ready');
  // Owner-reported columns only; no fabricated policies, triggers, or boards.
  psql(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    CREATE TABLE public.clothing_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL DEFAULT (auth.jwt()->>'sub'),
      name text NOT NULL, category text NOT NULL, image_path text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );`);
  const audit = await readFile(new URL('./audit/database-catalog.sql', import.meta.url), 'utf8');
  const output = psql(audit);
  assert.match(output, /clothing_items/);
  assert.match(output, /clothing_items_pkey/);
  assert.match(output, /ROLLBACK/);
  // PostgreSQL itself must reject writes in the same audit transaction mode.
  assert.throws(() => psql('BEGIN TRANSACTION READ ONLY; CREATE TABLE forbidden(id int); ROLLBACK;'), /read-only transaction/);
  console.log('PASS: catalog SQL executes against an isolated PostgreSQL fixture; read-only mode rejects writes.');
  console.log('NOT VERIFIED: deployed RLS, Storage policies, triggers, grants, Clerk integration, or Supabase Storage HTTP behavior.');
} finally {
  if (started) docker(['stop', '--time', '1', container]);
}
