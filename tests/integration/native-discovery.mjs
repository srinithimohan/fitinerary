import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Exact versions, including the platform binary's npm integrity. No install
// scripts, registry metadata lookup, or application environment is used.
const cliPackages = {
  aarch64: ['arm64', 'x/btGSaL7zlFyk2bvjJL8qfGJ1GY8jfh5D4bWl0mINeyNPlMyLz6oAw4ICRl05p3TU5SeHsiPptcBaohig7OOQ=='],
  x86_64: ['x64', 'dWs2FsUv7iBz9OLbhpgI9fyrvft1S5oh1uqeuhus3Mndlxu4cpMq+qaAt6PcnaC6bjw37q60HUkISgmjs/3z+g=='],
};
export const issuer = 'https://clerk.fixture.test';
export const cliImage = (project) => `${project}-native-cli:3.1.0`;

export async function prepareNativeDiscovery({ workdir, project, docker, env, privateValues }) {
  const directory = path.join(workdir, 'oidc');
  const build = path.join(workdir, 'native-cli');
  await mkdir(directory);
  await mkdir(build);
  // Ordinary Clerk session verification uses RS256; keep the project ES256 key
  // independent so provider discovery cannot be confused with project signing.
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = { ...pair.privateKey.export({ format: 'jwk' }), kid: `provider-${randomUUID()}`, alg: 'RS256', use: 'sig' };
  const publicKey = { ...pair.publicKey.export({ format: 'jwk' }), kid: privateKey.kid, alg: 'RS256', use: 'sig' };
  privateValues.push(privateKey.d);
  await writeFile(path.join(directory, 'jwks.json'), JSON.stringify({ keys: [publicKey] }));
  await writeFile(path.join(directory, 'tls.cnf'), `[req]\ndistinguished_name=dn\nx509_extensions=extensions\nprompt=no\n[dn]\nCN=clerk.fixture.test\n[extensions]\nsubjectAltName=DNS:clerk.fixture.test\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n`);
  const certificate = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
    '-config', path.join(directory, 'tls.cnf'), '-keyout', path.join(directory, 'server.key'), '-out', path.join(directory, 'server.crt')], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(certificate.status, 0, 'Could not create disposable HTTPS fixture certificate');
  await chmod(path.join(directory, 'server.key'), 0o600);
  await writeFile(path.join(directory, 'requests.jsonl'), '');
  await writeFile(path.join(directory, 'server.mjs'), await readFile(new URL('./oidc-server.mjs', import.meta.url)));

  const architecture = docker(['info', '--format', '{{.Architecture}}']).trim();
  assert.ok(cliPackages[architecture], 'Native discovery supports local Docker amd64 and arm64 only');
  const [cpu, integrity] = cliPackages[architecture];
  // Verify these independent download pins still match the checked-in lockfile.
  const lock = await readFile(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8');
  assert.ok(lock.includes(`'@supabase/cli-linux-${cpu}-musl@3.1.0':\n    resolution: {integrity: sha512-${integrity}}`));
  const response = await fetch(`https://registry.npmjs.org/@supabase/cli-linux-${cpu}-musl/-/cli-linux-${cpu}-musl-3.1.0.tgz`, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, 200, 'Pinned CLI binary download failed');
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha512').update(archive).digest('base64'), integrity, 'CLI binary integrity mismatch');
  const tarball = path.join(build, 'cli.tgz');
  await writeFile(tarball, archive);
  const extracted = spawnSync('tar', ['-xzf', tarball, '-C', build], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(extracted.status, 0, 'Could not extract verified CLI package');
  await writeFile(path.join(build, 'docker'), `#!/usr/local/bin/node\n${await readFile(new URL('./docker-loopback.mjs', import.meta.url), 'utf8')}`, { mode: 0o755 });
  await writeFile(path.join(build, 'Dockerfile'), `FROM docker:28.3.3-cli AS docker\nFROM node:22.17.0-alpine3.22\nCOPY --from=docker /usr/local/bin/docker /usr/local/bin/docker-real\nCOPY package/bin/supabase /usr/local/bin/supabase\nCOPY docker /usr/local/bin/docker\n`);
  docker(['build', '--quiet', '--label', `com.supabase.cli.project=${project}`, '-t', cliImage(project), build]);
  docker(['run', '-d', '--name', `fitinerary_oidc_${project}`, '--network', project, '--network-alias', 'clerk.fixture.test',
    '--label', `com.supabase.cli.project=${project}`, '--mount', `type=bind,src=${directory},dst=${directory}`,
    // Matching the bind-mount owner also works on native Linux with a 0600 key.
    // Allow the fixture's port 443 only in its own network namespace; no host
    // privileged port, capability, or daemon/global sysctl change is required.
    '--user', `${process.getuid()}:${process.getgid()}`, '--sysctl', 'net.ipv4.ip_unprivileged_port_start=0',
    '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    cliImage(project), 'node', path.join(directory, 'server.mjs'), directory]);
  // Poll through the same Docker DNS/TLS path the unmodified CLI will use.
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(['exec', `fitinerary_oidc_${project}`, 'node', '-e',
        `setTimeout(()=>process.exit(1),5000).unref();require('https').get(${JSON.stringify(`${issuer}/.well-known/openid-configuration`)},{ca:require('fs').readFileSync(${JSON.stringify(path.join(directory, 'server.crt'))})},r=>{r.resume();process.exitCode=r.statusCode===200?0:1}).on('error',()=>process.exitCode=1)`]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert.ok(ready, 'HTTPS discovery fixture did not become ready');
  // Remove readiness request from evidence: subsequent entries must be the CLI.
  await writeFile(path.join(directory, 'requests.jsonl'), '');
  return { privateKey, publicKey, directory };
}
