import assert from 'node:assert/strict';
import {createRepairReceiver,executeRepair} from '../src/research/repair-execution.mjs';
import {makeRepairCases} from '../src/research/repair-workloads.mjs';
import {freshctxBridge} from '../src/research/freshctx-bridge.mjs';
const receiver=await createRepairReceiver(),bridge=freshctxBridge();let checks=0;
try {
 for(const item of makeRepairCases({development:true,count:2})) {
  const native=await executeRepair(item,'selective_frontier',receiver);
  const external=await executeRepair(item,'freshctx_frontier',receiver,{externalGuard:bridge.check});
  assert.equal(external.evaluation?.success,true,item.id+':'+external.error);
  assert.equal(external.externalGuard.version,'0.16.0');
  for(const key of ['calls','newDisclosures','transmittedFields','reused','staleDispatches','unauthorizedDispatches'])assert.equal(external.metrics[key],native.metrics[key],item.id+':'+key);
  checks++;
 }
 console.log(JSON.stringify({externalLibrary:'freshctx',version:'0.16.0',developmentComparisons:checks}));
} finally {await receiver.close();await bridge.close();}
