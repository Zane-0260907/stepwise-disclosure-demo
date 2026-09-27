import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reference = value => typeof value === 'string' && /^local_ref_[0-9a-f]{16}$/.test(value);
const guardErrors = new Set(['REFERENCE_PURPOSE_MISMATCH', 'STALE_OR_UNBOUND_REFERENCE', 'UNKNOWN_OR_EMBEDDED_REFERENCE']);

function translate(value, aliases) {
  if (Array.isArray(value)) return value.map(v => translate(v, aliases));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, translate(v, aliases)]));
  if (typeof value !== 'string') return value;
  // Also preserve the embedded-reference rejection path, if it is present.
  return value.replace(/local_ref_[0-9a-f]{16}/g, token => aliases.get(token) || token);
}

function alignObservation(saved, replayed, aliases, reverse) {
  if (reference(saved)) {
    assert.ok(reference(replayed), 'A reference must remain opaque in both replay arms');
    if (aliases.has(saved)) assert.equal(aliases.get(saved), replayed, 'Reference identity changed');
    if (reverse.has(replayed)) assert.equal(reverse.get(replayed), saved, 'Distinct saved references collapsed');
    aliases.set(saved, replayed); reverse.set(replayed, saved);
    return;
  }
  if (Array.isArray(saved)) {
    assert.ok(Array.isArray(replayed)); assert.equal(saved.length, replayed.length);
    saved.forEach((v, i) => alignObservation(v, replayed[i], aliases, reverse));
    return;
  }
  if (saved && typeof saved === 'object') {
    assert.ok(replayed && typeof replayed === 'object' && !Array.isArray(replayed));
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(replayed).sort());
    for (const [k, v] of Object.entries(saved)) alignObservation(v, replayed[k], aliases, reverse);
    return;
  }
  assert.deepEqual(replayed, saved, 'Visible non-reference output changed');
}

/** Intervene only on reference guards, holding the recorded planner and customer
 * decisions fixed. Stop at first divergence: later saved decisions would no
 * longer be conditioned on the counterfactual observations. This does not run a
 * new model conversation or estimate population-level success probability.
 */
export async function pairedReplay(record, {makeViews, makeConfirmations, openBridge}) {
  const arms = ['tokenized', 'scoped'].map(mode => ({
    mode, bridge: openBridge(), views: makeViews({mode}), confirmations: makeConfirmations(),
    aliases: new Map(), reverse: new Map(), actions: [],
  }));
  const originalMode = record.method.startsWith('native-scoped') ? 'scoped' : 'tokenized';
  assert.ok(/^native-(?:scoped|tokenized)-local-confirmation$/.test(record.method));
  const panels = new Map(record.localPanels.map(p => [p.id, p]));
  assert.equal(panels.size, record.localPanels.length, 'Duplicated saved confirmation identifier');
  const steps = [];
  let firstDivergence = null;
  try {
    for (const arm of arms) {
      arm.info = await arm.bridge.call({command: 'init', domain: record.domain});
      assert.equal(arm.info.dbHash, record.initialDbHash);
    }
    for (const [index, saved] of record.actions.entries()) {
      const outcomes = [];
      for (const arm of arms) {
        const snapshot = await arm.bridge.call({command: 'snapshot'});
        assert.equal(snapshot.dbHash, saved.dbBefore, 'Replay prefix no longer matches the saved trajectory');
        const plannerArguments = translate(saved.plannerArguments, arm.aliases);
        const proposed = saved.exposedName.startsWith('propose_');
        const name = proposed ? saved.exposedName.slice(8) : saved.exposedName;
        assert.equal(name, saved.name);
        const exposed = new Set(arm.info.tools.map(t => arm.info.mutatingTools.includes(t.function.name) ? 'propose_' + t.function.name : t.function.name));
        let args = plannerArguments, nativeExecuted = false, result, guardError = null, beforeConfirmation;
        try {
          if (!exposed.has(saved.exposedName)) throw Error('UNEXPOSED_TOOL');
          args = arm.views.bind(name, plannerArguments, snapshot.db);
          if (proposed) {
            await arm.bridge.call({command: 'validate', name, arguments: args});
            beforeConfirmation = {name, arguments: args};
          }
        } catch (error) {
          guardError = error.message;
        }
        if (!guardError && proposed) {
          const panel = panels.get(saved.confirmationId);
          // The fixed customer decision is only valid for the same raw offer.
          assert.ok(panel, 'Missing fixed customer decision; counterfactual is undefined');
          assert.deepEqual(beforeConfirmation, {name: panel.name, arguments: panel.arguments});
          const offer = arm.confirmations.prepare({name, args, dbHash: snapshot.dbHash});
          try {
            args = arm.confirmations.consume(offer.id, {approved: panel.approved, dbHash: snapshot.dbHash}).args;
          } catch (error) { guardError = error.message; }
        }
        if (guardError) {
          result = {result: {error: guardError}, errorType: 'AdapterValidationError', dbBefore: snapshot.dbHash, dbAfter: snapshot.dbHash, mutatesState: false};
        } else {
          // Unexpected adapter/process failures are fatal to the audit, rather
          // than being converted into a convenient controller refusal.
          result = await arm.bridge.call({command: 'call', name, arguments: args});
          nativeExecuted = true;
        }
        const outcome = {name, arguments: args, nativeExecuted, ...result};
        if (arm.mode === originalMode) {
          assert.deepEqual(args, translate(saved.arguments, arm.aliases), 'Original arm no longer reproduces raw arguments');
          for (const key of ['nativeExecuted', 'result', 'errorType', 'dbBefore', 'dbAfter', 'mutatesState']) assert.deepEqual(outcome[key], saved[key], 'Original arm differs: ' + key);
        }
        arm.actions.push(outcome);
        outcomes.push({arm, outcome, guardError});
      }
      const normalized = outcomes.map(({arm, outcome}) => translate(outcome, arm.reverse));
      const same = JSON.stringify(normalized[0]) === JSON.stringify(normalized[1]);
      steps.push({index, name: saved.name, toolCallId: saved.toolCallId, same,
        arms: Object.fromEntries(outcomes.map(({arm, outcome, guardError}) => [arm.mode, {
          nativeExecuted: outcome.nativeExecuted, argumentsSha256: digest(translate(outcome.arguments, arm.reverse)),
          resultSha256: digest(translate(outcome.result, arm.reverse)), dbBefore: outcome.dbBefore, dbAfter: outcome.dbAfter,
          bindingGuardRefusal: guardErrors.has(guardError) ? guardError : null,
          errorType: outcome.errorType,
        }]))});
      if (!same) { firstDivergence = index; break; }
      for (const {arm, outcome} of outcomes) {
        const observation = arm.views.project(outcome.result, {sourceRoot: arm.views.sourceRoot(outcome.name, outcome.arguments, outcome.result, record.domain)});
        alignObservation(saved.observation, observation, arm.aliases, arm.reverse);
      }
    }
    const finalStates = {};
    for (const arm of arms) {
      const state = await arm.bridge.call({command: 'snapshot'});
      finalStates[arm.mode] = state.dbHash;
      if (firstDivergence === null) assert.equal(state.dbHash, record.finalDbHash);
    }
    return {caseId: record.caseId, originalMethod: record.method, actionsInSavedTrace: record.actions.length,
      actionsCompared: steps.length, samePrefixActions: steps.filter(s => s.same).length, firstDivergence,
      equivalentOnRecordedTrajectory: firstDivergence === null, finalStates, steps};
  } finally {
    await Promise.all(arms.map(arm => arm.bridge.close()));
  }
}
