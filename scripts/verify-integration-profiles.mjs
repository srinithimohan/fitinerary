import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { required, diagnostic, integrationProfile } from '../tests/integration/profiles.mjs';

assert.deepEqual(diagnostic, [...required, 'issuer-conformance.test.mjs']);
assert.equal(new Set(diagnostic).size, diagnostic.length);
assert.ok(!required.includes('issuer-conformance.test.mjs'));
for (const profile of ['required', 'diagnostic']) assert.equal(integrationProfile([`--profile=${profile}`]).name, profile);
assert.throws(() => integrationProfile(['--test-name-pattern=owner']));
assert.throws(() => integrationProfile(['--profile=unknown']));
const fingerprintFile = new URL('../tests/integration/fixtures/issuer-assertion-fingerprints.json', import.meta.url);
const expected = JSON.parse(await readFile(fingerprintFile, 'utf8'));
const found = {};
for (const file of diagnostic) {
  const text = await readFile(new URL(`../tests/integration/${file}`, import.meta.url), 'utf8');
  assert.ok(!/\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(/.test(text), `Filtered test registration: ${file}`);
  if (required.includes(file)) {
    assert.ok(!text.includes('untrusted issuer (same trusted key)') && !text.includes('rejects a wrong issuer even when'), 'Issuer conformance belongs in its explicit diagnostic file');
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'assert.deepEqual'
      && node.arguments.length === 3 && ts.isStringLiteral(node.arguments[2])) {
      const message = node.arguments[2].text;
      if (file === 'issuer-conformance.test.mjs' && Object.hasOwn(expected, message)) {
        assert.ok(!Object.hasOwn(found, message), 'Duplicate issuer assertion');
        found[message] = createHash('sha256').update(node.getText(source)).digest('hex');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
assert.equal(Object.keys(expected).length, 1);
assert.deepEqual(found, expected, 'An original issuer assertion was changed or omitted');
console.log('PASS: required/full diagnostic file partitions are explicit; the original project-key issuer assertion is byte-for-byte preserved; no skipped/only/todo registrations.');
