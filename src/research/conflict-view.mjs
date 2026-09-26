import { evaluateLocalProgram, hash } from './local-program.mjs';

// Equality is intentionally limited to syntax with commutative operands sorted.
// Equal answers on one record are not evidence of equivalent programs.
export function inspectCandidate(program, item) {
  const certificate = evaluateLocalProgram(program, item.facts, item.schema.map(cell => cell.id));
  const nodes = [];
  for (const expression of program) {
    const children = expression.args.map(arg => 'field' in arg ? `field:${arg.field}` :
      'constant' in arg ? `constant:${arg.constant}` : nodes[arg.step]);
    if (['add', 'multiply', 'min', 'max'].includes(expression.op)) children.sort();
    nodes.push(hash([expression.op, children]));
  }
  return { signature: nodes.at(-1), certificate };
}

// Exact minimum-cardinality cover for the finite proposal set (three proposals
// in this protocol). Coverage is syntactic disagreement, not semantic utility.
export function chooseConflictView(candidates, allowedFields, budget = 3) {
  if (!Number.isInteger(budget) || budget < 0 || budget > 12) throw Error('INVALID_VIEW_BUDGET');
  const unique = [...new Map(candidates.map(c => [c.signature, c])).values()];
  if (unique.length > 3) throw Error('TOO_MANY_CANDIDATES');
  const allowed = new Set(allowedFields), obligations = [];
  for (let i = 0; i < unique.length; i++) for (let j = i + 1; j < unique.length; j++) {
    const left = new Set(unique[i].certificate.dependencies.map(d => d.field));
    const right = new Set(unique[j].certificate.dependencies.map(d => d.field));
    const difference = [...new Set([...left, ...right])].filter(f => left.has(f) !== right.has(f));
    const fields = (difference.length ? difference : [...new Set([...left, ...right])]).filter(f => allowed.has(f)).sort();
    obligations.push({ pair: [i, j], fields, kind: difference.length ? 'dependency' : 'operator' });
  }
  if (!obligations.length) return { fields: [], obligations, covered: true, budget, minimumCardinality: 0 };
  if (obligations.some(o => !o.fields.length)) return { fields: [], obligations, covered: false, budget, reason: 'no-authorized-witness' };
  let best = null;
  function search(selected) {
    if (selected.size > budget || (best && selected.size > best.length)) return;
    const missing = obligations.filter(o => !o.fields.some(f => selected.has(f)));
    if (!missing.length) {
      const sorted = [...selected].sort();
      if (!best || sorted.length < best.length || (sorted.length === best.length && sorted.join('|') < best.join('|'))) best = sorted;
      return;
    }
    if (best && selected.size === best.length) return;
    const next = missing.sort((a, b) => a.fields.length - b.fields.length)[0];
    for (const field of next.fields) search(new Set([...selected, field]));
  }
  search(new Set());
  return { fields: best || [], obligations, covered: Boolean(best), budget,
    ...(best ? { minimumCardinality: best.length } : { reason: 'budget-insufficient' }) };
}

export function majorityCandidate(candidates) {
  if (!candidates.length) throw Error('NO_VALID_CANDIDATE');
  const counts = new Map();
  for (const candidate of candidates) counts.set(candidate.signature, (counts.get(candidate.signature) || 0) + 1);
  return candidates.reduce((best, candidate) => counts.get(candidate.signature) > counts.get(best.signature) ? candidate : best);
}
