import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCandidate, chooseConflictView, majorityCandidate } from '../src/research/conflict-view.mjs';

const item = { facts: { a: 2, b: 2, c: 5, d: 9 }, schema: ['a', 'b', 'c', 'd'].map(id => ({ id })) };
const program = (op, a, b) => [{ op, args: [{ field: a }, { field: b }] }];

test('equal numeric answers do not conceal distinct source dependencies', () => {
  const a = inspectCandidate(program('divide', 'a', 'c'), item);
  const b = inspectCandidate(program('divide', 'b', 'c'), item);
  assert.equal(a.certificate.value, b.certificate.value);
  assert.notEqual(a.signature, b.signature);
  const view = chooseConflictView([a, b], ['a', 'b', 'c'], 1);
  assert.deepEqual(view.fields, ['a']);
  assert.equal(view.obligations[0].kind, 'dependency');
});

test('commutative normalization, operator conflicts and authorization are separate', () => {
  const a = inspectCandidate(program('add', 'a', 'c'), item);
  const equivalent = inspectCandidate(program('add', 'c', 'a'), item);
  const different = inspectCandidate(program('subtract', 'a', 'c'), item);
  assert.equal(a.signature, equivalent.signature);
  assert.equal(chooseConflictView([a, equivalent], [], 0).covered, true);
  assert.equal(chooseConflictView([a, different], [], 3).covered, false);
  assert.equal(chooseConflictView([a, different], ['c'], 1).obligations[0].kind, 'operator');
  assert.deepEqual(chooseConflictView([a, different], ['c'], 1).fields, ['c']);
  assert.equal(majorityCandidate([different, a, equivalent]).signature, a.signature);
});

test('exact cover matches exhaustive subset search across generated dependency families', () => {
  const fields = ['a', 'b', 'c', 'd'];
  for (let seed = 1; seed <= 60; seed++) {
    const candidates = [0, 1, 2].map(i => ({ signature: `${i}`, certificate: { dependencies: fields.filter((_, j) => ((seed * (i + 2) + j * 7) >> j) & 1).map(field => ({ field })) } }));
    const view = chooseConflictView(candidates, fields, 3);
    const possible = Array.from({ length: 16 }, (_, bits) => fields.filter((_, j) => bits & (1 << j)))
      .filter(subset => subset.length <= 3 && view.obligations.every(o => o.fields.some(f => subset.includes(f))))
      .sort((a, b) => a.length - b.length || a.join('|').localeCompare(b.join('|')));
    assert.equal(view.covered, possible.length > 0);
    if (possible.length) assert.deepEqual(view.fields, possible[0]);
  }
});
