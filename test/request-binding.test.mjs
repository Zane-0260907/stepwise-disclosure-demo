import test from 'node:test';
import assert from 'node:assert/strict';
import { bindingStudy } from '../scripts/validate-request-binding.mjs';
test('final-body mutations and stale plans are refused before a real receiver sees them',async()=>{
  const result=await bindingStudy();
  assert.equal(result.v2Blocked,result.attackCasesPerMode);
  assert.ok(result.v1Blocked<result.v2Blocked,'negative control must expose the missing coverage');
});
