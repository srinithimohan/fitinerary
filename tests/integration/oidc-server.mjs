// Discovery/JWKS fixture only: this server never receives application JWTs and
// does not proxy, authenticate, or forward REST/Storage requests.
import { createServer } from 'node:https';
import { readFileSync, appendFileSync } from 'node:fs';

const directory = process.argv[2];
const issuer = 'https://clerk.fixture.test';
const documents = new Map([
  ['/.well-known/openid-configuration', { issuer, jwks_uri: `${issuer}/.well-known/jwks.json` }],
  ['/.well-known/jwks.json', JSON.parse(readFileSync(`${directory}/jwks.json`, 'utf8'))],
]);
createServer({ key: readFileSync(`${directory}/server.key`), cert: readFileSync(`${directory}/server.crt`) }, (req, res) => {
  if (req.method !== 'GET' || req.headers.host !== 'clerk.fixture.test' || !documents.has(req.url)) {
    res.writeHead(404).end();
    return;
  }
  // Fixed paths only, never headers, query strings, tokens, or key material.
  appendFileSync(`${directory}/requests.jsonl`, `${JSON.stringify(req.url)}\n`);
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(documents.get(req.url)));
}).listen(443, '0.0.0.0');
