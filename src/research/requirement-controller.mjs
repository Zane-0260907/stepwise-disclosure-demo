import {createHash} from 'node:crypto';

const clone = x => structuredClone(x);
const hash = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const owns = (x, k) => Object.hasOwn(x, k);
const compare = (a, b) => a.newItems.length - b.newItems.length || a.bytes - b.bytes || a.id.localeCompare(b.id);

/** A finite, trusted contract controller; NOT a natural-language sufficiency
 * oracle. Contracts, pure local functions and disclosure permissions are supplied
 * by the local application, never by a model or an evaluation-label file.
 * All representations must implement the SAME contract. The generic controller
 * neither establishes their semantic equivalence nor discovers new contracts.
 */
export function requirementController({contracts, snapshot, authorize, transport}) {
  const history = new Set(), events = [], attempts = new Set(), registered = new Map();
  for (const contract of contracts) {
    if (!contract.id || registered.has(contract.id)) throw Error('DUPLICATE_CONTRACT');
    const ids = new Set();
    for (const option of contract.options) {
      if (ids.has(option.id)) throw Error('DUPLICATE_REPRESENTATION');
      ids.add(option.id);
    }
    registered.set(contract.id, contract);
  }
  // Tickets are process-local capabilities. Callers cannot invent a missing
  // condition, change the recipient or replace the bytes after approval.
  const tickets = new WeakMap();
  function inspect(contractId, recipient, requested = []) {
    const contract = registered.get(contractId);
    if (!contract) throw Error('UNKNOWN_CONTRACT');
    const state = clone(snapshot());
    const requirements = [...new Set(contract.required(state))].sort();
    if (requested.some(x => !requirements.includes(x))) throw Error('UNVERIFIED_INFORMATION_REQUEST');
    const options = [], unavailable = [];
    for (const option of contract.options) {
      // The requirement list is a registered structural condition, not a claim
      // that arbitrary generated prose is semantically sufficient.
      if (!requirements.every(r => option.covers.includes(r))) continue;
      const dependencies = [...new Set(option.dependencies(state))].sort();
      if (dependencies.some(k => !owns(state.values, k) || !Number.isSafeInteger(state.versions[k]))) {
        unavailable.push({id: option.id, reason: 'SOURCE_MISSING'}); continue;
      }
      if (!option.available(state)) { unavailable.push({id: option.id, reason: 'CAPABILITY_UNAVAILABLE'}); continue; }
      const material = clone(option.evaluate(clone(state.values)));
      if (!contract.validate(material, option.kind)) throw Error('REGISTERED_REPRESENTATION_INVALID');
      if (option.kind !== 'local' && option.kind !== 'remote') throw Error('INVALID_EXECUTION_KIND');
      if (option.kind === 'local' && !contract.validateResult(material)) throw Error('LOCAL_RESULT_CONTRACT_FAILED');
      const dependencyVersions = Object.fromEntries(dependencies.map(k => [k, state.versions[k]]));
      const payload = option.kind === 'remote' ? {contract: contract.id, representation: option.id, input: material} : null;
      const body = payload === null ? null : JSON.stringify(payload);
      // Include recipient, representation, field and source versions. A derived
      // field still counts as disclosure, and a source-version change is new.
      const items = payload === null ? [] : Object.keys(material).sort().map(k => hash([recipient, contract.id, option.id, k, material[k], dependencyVersions]));
      const permission = {contract: contract.id, recipient, representation: option.id, kind: option.kind, fields: Object.keys(material)};
      if (!authorize(clone(permission), clone(state))) { unavailable.push({id: option.id, reason: 'NOT_AUTHORIZED'}); continue; }
      options.push({id: option.id, kind: option.kind, dependencyVersions, material, body, items,
        newItems: items.filter(x => !history.has(x)), bytes: body === null ? 0 : Buffer.byteLength(body), permission});
    }
    const selected = options.sort(compare)[0];
    events.push({type: 'requirements.checked', contract: contractId, recipient, requirements,
      alternatives: options.map(({id, kind, newItems, bytes}) => ({id, kind, addedItems: newItems.length, bytes})), unavailable,
      selected: selected?.id ?? null});
    if (!selected) return {status: 'blocked', requirements, unavailable};
    const ticket = Object.freeze({status: 'ready', contract: contractId, recipient,
      representation: selected.id, kind: selected.kind, addedItems: selected.newItems.length, bytes: selected.bytes});
    tickets.set(ticket, {contract, selected: clone(selected), stateHash: hash(state)});
    return ticket;
  }
  async function execute(ticket) {
    const prepared = tickets.get(ticket);
    if (!prepared || attempts.has(ticket)) throw Error('INVALID_OR_CONSUMED_TICKET');
    // Conservative whole-state check: unrelated changes also require a new
    // ticket. This implementation does NOT claim selective invalidation here.
    const state = clone(snapshot());
    if (hash(state) !== prepared.stateHash) throw Error('STATE_CHANGED_REPLAN');
    const {contract, selected} = prepared;
    if (!authorize(clone(selected.permission), clone(state))) throw Error('AUTHORIZATION_CHANGED');
    attempts.add(ticket);
    if (selected.kind === 'local') {
      events.push({type: 'completed.locally', contract: ticket.contract, representation: ticket.representation});
      return clone(selected.material);
    }
    // Conservatively charge before transmission. Failure or an unmatched
    // acknowledgement must never roll back possibly disclosed information.
    selected.items.forEach(x => history.add(x));
    events.push({type: 'transmission.attempted', recipient: ticket.recipient, representation: ticket.representation,
      bodySha256: hash(selected.body), cumulativeItems: history.size, bytes: selected.bytes});
    let receipt;
    try {
      receipt = await transport({recipient: ticket.recipient, body: selected.body});
      if (receipt.requestSha256 !== hash(selected.body)) throw Error('RECEIPT_MISMATCH');
      if (!contract.validateResult(receipt.result)) throw Error('RESULT_CONTRACT_FAILED');
    } catch (error) {
      events.push({type: 'transmission.uncertain', reason: error.message}); throw error;
    }
    events.push({type: 'receipt.verified', recipient: ticket.recipient, bodySha256: receipt.requestSha256});
    return clone(receipt.result);
  }
  return {inspect, execute, get history() { return [...history].sort(); }, get events() { return clone(events); }};
}

export const requestDigest = hash;
