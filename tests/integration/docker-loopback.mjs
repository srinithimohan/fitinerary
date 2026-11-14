// The pinned CLI publishes `-p host:container` without an address. Apply the
// loopback address before creation; never change Docker daemon/global settings.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const binary = process.env.FITINERARY_DOCKER_BINARY;
const project = process.env.FITINERARY_DOCKER_PROJECT;
assert.ok(binary?.startsWith('/'), 'Missing real local Docker executable');
assert.match(project, /^fitinerary-it-[0-9a-f]{8}$/);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' || args[i] === '--publish') {
    assert.ok(['create', 'run'].includes(args[0]));
    const name = args[args.indexOf('--name') + 1];
    assert.ok(args.includes('--name') && name.startsWith('supabase_') && name.endsWith(`_${project}`), 'Unexpected port-publishing target');
    assert.match(args[i + 1], /^\d+:\d+(?:\/(?:tcp|udp))?$/, 'Unexpected port format');
    let mapping = args[++i];
    // Containerized CLI probes Kong using its internal DNS/port; host tests use
    // the original fixed loopback port. This is port binding, not an HTTP proxy.
    if (process.env.FITINERARY_CONTAINER_CLI === 'true' && name === `supabase_kong_${project}`) {
      assert.equal(mapping, '8000:8000');
      mapping = '55321:8000';
    }
    if (process.env.FITINERARY_CONTAINER_CLI === 'true' && name === `supabase_db_${project}`) {
      assert.equal(mapping, '5432:5432');
      mapping = '55322:5432';
    }
    args[i] = `127.0.0.1:${mapping}`;
  }
}
const result = spawnSync(binary, args, { env: process.env, stdio: 'inherit' });
if (result.error) process.exitCode = 1;
else process.exitCode = result.status ?? 1;
