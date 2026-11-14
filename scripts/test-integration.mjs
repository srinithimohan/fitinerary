import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { accessSync, constants, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrationProfile } from '../tests/integration/profiles.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'node_modules/.bin/supabase');
const profile = integrationProfile(process.argv.slice(2));
// Never pass application credentials, remote project configuration, or provider
// domains to the CLI. The temporary project has no link or production .env.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'HOME', 'USER', 'TMPDIR', 'SystemRoot', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'CI'].includes(key)));
env.SUPABASE_TELEMETRY_DISABLED = 'true';
let project = `fitinerary-it-${randomUUID().slice(0, 8)}`;
const marker = path.join(root, '.local/integration-run.json');
let workdir;
let ownsMarker = false;
let active;
let cleaned = false;
const privateValues = [];
function sanitized(text) {
  for (const value of privateValues) text = text.replaceAll(value, '[redacted]');
  return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted-key]')
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+@/g, '$1[redacted]@');
}

function docker(args, input) {
  const r = spawnSync('docker', args, { env, input, encoding: 'utf8', timeout: 120_000 });
  assert.ok(!r.error && r.status === 0, `Local Docker command failed (${args[0]} ${args[1] ?? ''}): ${sanitized(r.stderr?.slice(-1500) ?? '')}`);
  return r.stdout;
}
function removeResources(args) {
  const r = spawnSync('docker', args, { env, encoding: 'utf8', timeout: 60_000 });
  if (r.error) throw new Error(`Local cleanup command failed: ${r.error.code}`);
  if (r.status !== 0) {
    const lines = r.stderr.trim().split('\n').filter(Boolean);
    assert.ok(lines.length && lines.every((line) => /already in progress|[Nn]o such (?:container|volume|network)/.test(line)), sanitized(r.stderr));
  }
}
function runCli(args, timeout = 900_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, [...args, '--workdir', workdir], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    active = child;
    let output = '';
    let errors = '';
    let timedOut = false;
    // CLI output can include credentials. Relay only redacted failure diagnostics.
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-20000); });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, timeout);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      active = undefined;
      if (code === 0) resolve(output);
      else {
        const diagnostic = (errors + (args[0] === 'start' ? output : '')).split('\n').slice(-20).join('\n');
        reject(new Error(`Supabase ${args[0]} ${timedOut ? 'timed out' : 'failed'} (${code ?? 'terminated'}). ${sanitized(diagnostic)}`));
      }
    });
  });
}
async function cleanup() {
  if (cleaned || !workdir) return;
  cleaned = true;
  if (active) active.kill('SIGTERM');
  // Only resources of this random, task-owned project are selected. This also
  // catches partial startup and runs when CLI stop itself fails.
  try { await runCli(['stop', '--no-backup'], 60_000); } catch { /* explicit fallback below */ }
  let empty = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const networks = docker(['network', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean);
    const containers = new Set(docker(['ps', '-aq', '--no-trunc', '--filter', `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean));
    // One-shot Storage migration containers can be unlabelled. Full IDs also
    // deduplicate containers present in both inventories.
    for (const network of networks) {
      const attached = JSON.parse(docker(['network', 'inspect', '--format', '{{json .Containers}}', network]));
      for (const container of Object.keys(attached ?? {})) containers.add(container);
    }
    if (!containers.size) { empty = true; break; }
    removeResources(['rm', '-fv', ...containers]);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(empty, 'Disposable containers did not finish removal; retain marker for --cleanup');
  const volumes = docker(['volume', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean);
  if (volumes.length) removeResources(['volume', 'rm', ...volumes]);
  const networks = docker(['network', 'ls', '-q', '--filter', `label=com.supabase.cli.project=${project}`]).trim().split(/\s+/).filter(Boolean);
  if (networks.length) removeResources(['network', 'rm', ...networks]);
  await rm(workdir, { recursive: true, force: true });
  if (ownsMarker) await rm(marker, { force: true });
  console.log('Disposable Supabase project cleaned up.');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void cleanup().then(() => process.exit(128 + (signal === 'SIGINT' ? 2 : 15)));
});

try {
  if (env.DOCKER_HOST) assert.match(env.DOCKER_HOST, /^(unix|npipe):\/\//, 'Remote Docker hosts are forbidden');
  assert.match(docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim(), /^(unix|npipe):\/\//, 'Remote Docker contexts are forbidden');
  if (process.argv.includes('--cleanup')) {
    let previous;
    try { previous = JSON.parse(await readFile(marker, 'utf8')); } catch (error) {
      if (error.code === 'ENOENT') process.exit(0);
      throw error;
    }
    assert.match(previous.project, /^fitinerary-it-[0-9a-f]{8}$/);
    assert.equal(path.dirname(path.resolve(previous.workdir)), path.resolve(tmpdir()));
    assert.match(path.basename(previous.workdir), /^fitinerary-integration-[A-Za-z0-9]{6}$/);
    project = previous.project;
    workdir = previous.workdir;
    ownsMarker = true;
    await cleanup();
  } else {
  await readFile(new URL('../tests/integration/fixtures/schema.sql', import.meta.url));
  await readFile(new URL('../tests/integration/fixtures/catalog.json', import.meta.url));
  const ownershipMigration = await readFile(new URL('../supabase/migrations/20261109000100_board_item_clothing_ownership.sql', import.meta.url), 'utf8');
  await readFile(new URL('../tests/integration/fixtures/catalog.ownership-target.json', import.meta.url));
  for (const file of profile.files) await readFile(new URL(`../tests/integration/${file}`, import.meta.url));
  workdir = await mkdtemp(path.join(tmpdir(), 'fitinerary-integration-'));
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, JSON.stringify({ project, workdir }), { mode: 0o600, flag: 'wx' });
  ownsMarker = true;
  await mkdir(path.join(workdir, 'supabase'));
  await mkdir(path.join(workdir, 'supabase/.temp'));
  for (const [file, version] of Object.entries({ 'postgres-version': '17.11.0.018', 'gotrue-version': 'v2.197.0', 'rest-version': 'v16.5', 'storage-version': 'v1.90.1' })) {
    await writeFile(path.join(workdir, 'supabase/.temp', file), version);
  }
  const realDocker = env.PATH.split(path.delimiter).map((entry) => path.join(entry, 'docker')).find((candidate) => {
    try { accessSync(candidate, constants.X_OK); return true; } catch { return false; }
  });
  assert.ok(realDocker, 'Local Docker executable not found');
  const bin = path.join(workdir, 'bin');
  await mkdir(bin);
  await writeFile(path.join(bin, 'docker'), `#!${process.execPath}\nimport(${JSON.stringify(new URL('../tests/integration/docker-loopback.mjs', import.meta.url).href)});\n`, { mode: 0o700 });
  env.FITINERARY_DOCKER_BINARY = realpathSync(realDocker);
  env.FITINERARY_DOCKER_PROJECT = project;
  env.PATH = `${bin}${path.delimiter}${env.PATH}`;
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const key = { ...pair.privateKey.export({ format: 'jwk' }), kid: randomUUID(), alg: 'ES256', use: 'sig', key_ops: ['sign', 'verify'], ext: true };
  privateValues.push(key.d);
  const localSecret = randomBytes(48).toString('base64url');
  privateValues.push(localSecret);
  await writeFile(path.join(workdir, 'supabase/signing-keys.json'), JSON.stringify([key]), { mode: 0o600 });
  await writeFile(path.join(workdir, 'supabase/config.toml'), `project_id = "${project}"
[api]
enabled = true
port = 55321
schemas = ["public"]
extra_search_path = ["public", "extensions"]
[db]
port = 55322
shadow_port = 55320
major_version = 17
[db.seed]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:55321"
signing_keys_path = "./signing-keys.json"
jwt_secret = "${localSecret}"
[storage]
enabled = true
file_size_limit = "5MiB"
[storage.s3_protocol]
enabled = false
[studio]
enabled = false
[analytics]
enabled = false
[local_smtp]
enabled = false
`);
  console.log('Starting pinned disposable Supabase services (first run downloads images).');
  console.log('AUTH LIMITATION: local asymmetric signing keys are NOT native Clerk third-party authentication evidence.');
  docker(['network', 'create', '--label', `com.supabase.cli.project=${project}`,
    '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', project]);
  await runCli(['start', '--network-id', project, '--exclude', 'realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
  for (const [service, tag] of Object.entries({ db: '17.11.0.018', auth: 'v2.197.0', rest: 'v16.5', storage: 'v1.90.1', kong: '2.8.1' })) {
    const image = docker(['inspect', '--format', '{{.Config.Image}}', `supabase_${service}_${project}`]).trim();
    assert.equal(image.split(':').at(-1), tag, `Unexpected ${service} image version`);
  }
  for (const name of [`supabase_kong_${project}`, `supabase_db_${project}`]) {
    const bindings = JSON.parse(docker(['inspect', '--format', '{{json .HostConfig.PortBindings}}', name]));
    assert.ok(Object.values(bindings).flat().length > 0, 'Service has no published test port');
    for (const binding of Object.values(bindings).flat()) assert.equal(binding.HostIp, '127.0.0.1', 'Services must bind only to loopback');
  }
  const status = JSON.parse(await runCli(['status', '--output', 'json']));
  privateValues.push(...Object.entries(status).filter(([k, v]) => /KEY|SECRET|PASSWORD/i.test(k) && typeof v === 'string' && v.length > 0).map(([, v]) => v));
  const url = status.API_URL ?? status.api_url;
  assert.equal(new URL(url).hostname, '127.0.0.1', 'Only IPv4 loopback API permitted');
  assert.equal(new URL(url).port, '55321');
  const container = `supabase_db_${project}`;
  // The provider's bootstrap superuser is used only for this fixture: ordinary
  // postgres cannot replay reserved role attributes on Supabase's PG image.
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'],
    await readFile(new URL('../tests/integration/fixtures/schema.sql', import.meta.url), 'utf8'));
  // Preserve and verify the owner-supplied before-state, then apply the approved
  // migration explicitly to this random local container only.
  const beforeCatalog = JSON.parse(await readFile(new URL('../tests/integration/fixtures/catalog.json', import.meta.url), 'utf8'));
  const policyRows = docker(['exec', '-i', container, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], `BEGIN READ ONLY;
    SELECT json_agg(p ORDER BY schemaname, tablename, policyname)::text FROM (
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
      WHERE (schemaname='public' AND tablename IN ('clothing_items','boards','board_items'))
        OR (schemaname='storage' AND tablename IN ('objects','buckets'))
    ) p;
    ROLLBACK;`);
  assert.deepEqual(JSON.parse(policyRows.split('\n').filter((line) => !['BEGIN', 'ROLLBACK', ''].includes(line)).join('\n')), beforeCatalog.policies,
    'The audited policy baseline must match before applying the security migration');
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'],
    `${ownershipMigration}\nNOTIFY pgrst, 'reload schema';\n`);
  // Setup-only legacy data: deliberately invalid references must remain visible
  // to the read-only preflight even after RLS starts rejecting new violations.
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres'],
    await readFile(new URL('../tests/integration/fixtures/reference-audit-seed.sql', import.meta.url), 'utf8'));
  const anonKey = status.ANON_KEY ?? status.anon_key;
  assert.ok(anonKey, 'Local anonymous API credential unavailable');
  let schemaReady = false;
  for (let i = 0; i < 60; i++) {
    const response = await fetch(`${url}/rest/v1/clothing_items?select=id&limit=0`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (response.ok) { schemaReady = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(schemaReady, 'PostgREST did not load the authorization fixture');
  const state = path.join(workdir, 'state.json');
  await writeFile(state, JSON.stringify({
    project, container, url, anonKey,
    serviceKey: status.SERVICE_ROLE_KEY ?? status.service_role_key,
    privateKey: key, issuer: 'https://clerk.integration.invalid',
  }), { mode: 0o600 });
  console.log(`Integration profile: ${profile.name}; ${profile.name === 'required' ? 'supported guarantees only; issuer assertions execute in the separate full diagnostic' : 'all supported guarantees AND both strict issuer assertions'}.`);
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...profile.files.map((file) => `tests/integration/${file}`)], {
    cwd: root, env: { ...env, FITINERARY_INTEGRATION_STATE: state }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  active = child;
  let testOutput = '';
  for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.on('data', (chunk) => {
      const output = sanitized(chunk.toString());
      testOutput += output;
      destination.write(output);
    });
  }
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      active = undefined;
      writeFile(path.join(root, `.local/integration-${profile.name}-tests.log`), testOutput, { mode: 0o600 }).then(() => resolve(code ?? 1), reject);
    });
  });
  }
} catch (error) {
  console.error(sanitized(error.message));
  process.exitCode = 1;
} finally {
  await cleanup();
}
