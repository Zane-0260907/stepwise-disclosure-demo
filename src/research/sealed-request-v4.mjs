import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { addEvent } from './engine.mjs';
import { neededFacts, localAssessment } from './policy.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const blocked = code => { throw new Error(`BOUNDARY_${code}`); };

// A ticket belongs to one run, one step and one exact serialization. It is kept
// outside the mutable trace. This is an application-level boundary, not a
// sandbox against a compromised host or code that bypasses the adapter.
export function createSealedRequestGate(transport, notify = () => {}) {
  const tickets = new Map();
  return {
    prepare({run, step, item, view, payload}) {
      const serialized = JSON.stringify(payload);
      const recipient = step.operation === 'lookup_reference' ? 'reference-service' : 'cloud-model';
      const expectedKeys = Object.keys(view).sort();
      let actual;
      if (recipient === 'cloud-model') {
        if (payload.messages?.length !== 2 || payload.messages[1]?.role !== 'user') blocked('INVALID_ENVELOPE');
        actual = JSON.parse(payload.messages[1].content).facts;
      } else {
        actual = {reference_code:payload.code, reference_version:payload.version, ...payload.context};
      }
      if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(expectedKeys)) blocked('VIEW_KEYS_MISMATCH');
      for (const key of expectedKeys) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(item.facts[key])) blocked('SOURCE_VALUE_MISMATCH');
      }
      if (['joint','per_step'].includes(run.method)) {
        const necessary = neededFacts(item,step.operation);
        if (expectedKeys.some(key=>!necessary.includes(key))) blocked('EXTRA_FIELD');
      }
      const key = `${run.id}/${step.id}`;
      if (tickets.has(key)) blocked('DUPLICATE_PLAN');
      const dependencies=Object.freeze(expectedKeys.map(field=>Object.freeze({field,sha256:digest(JSON.stringify(item.facts[field]))})));
      Object.freeze(expectedKeys);
      const ticket = Object.freeze({id:randomUUID(),runId:run.id,stepId:step.id,operation:step.operation,recipient,
        policyVersion:step.plannedPolicyVersion,serialized,sha256:digest(serialized),fields:expectedKeys,
        source:item,dependencies});
      tickets.set(key,ticket);
      step.requestPlan={id:ticket.id,recipient,policyVersion:ticket.policyVersion,sha256:ticket.sha256,fields:[...expectedKeys],dependencies:structuredClone(dependencies)};
      return ticket.id;
    },
    transport: {
      testing: transport.testing,
      async send(run, step, payload, recipient) {
        const start=performance.now();
        const key=`${run.id}/${step.id}`;
        const ticket=tickets.get(key);
        if (!ticket) blocked('NO_TICKET');
        if (!run.policy.allowed || run.policy.version!==ticket.policyVersion) blocked('POLICY_CHANGED');
        if (recipient!==ticket.recipient || step.recipient!==ticket.recipient || step.operation!==ticket.operation) blocked('RECIPIENT_CHANGED');
        for(const {field,sha256} of ticket.dependencies) {
          const value=ticket.source.facts[field];
          if(value===undefined || digest(JSON.stringify(value))!==sha256) blocked('SOURCE_CHANGED');
        }
        const serialized=JSON.stringify(payload);
        if (serialized!==ticket.serialized) blocked('REQUEST_CHANGED');
        tickets.delete(key); // one-use; retry requires a new plan and current authorization
        const snapshot=JSON.parse(serialized);
        const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
        freeze(snapshot);
        const overheadMs=performance.now()-start;
        run.metrics.controlMs.push(overheadMs);
        step.checks.push({kind:'serialized-request',ticketId:ticket.id,sha256:ticket.sha256,policyVersion:run.policy.version,overheadMs});
        addEvent(run,'request.bound',{stepId:step.id,ticketId:ticket.id,sha256:ticket.sha256},notify);
        // The registered transport serializes synchronously before its first
        // await. No mutable application object is handed to it.
        const envelope=await transport.send(run,step,snapshot,recipient);
        const receipt=envelope.receipt;
        if (!receipt || receipt.runId!==run.id || receipt.stepId!==step.id || receipt.recipient!==recipient ||
            receipt.rawBody!==serialized || receipt.sha256!==ticket.sha256 || receipt.bytes!==Buffer.byteLength(serialized)) {
          blocked('RECEIPT_MISMATCH');
        }
        step.requestPlan.receiptId=receipt.id;
        step.requestPlan.receiptVerified=true;
        return envelope;
      }
    }
  };
}

