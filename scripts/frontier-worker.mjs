import {parentPort} from 'node:worker_threads';
import {planLiveFrontier} from '../src/research/live-frontier.mjs';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
parentPort.on('message',({workload,method,budget,limit})=>{
 const started=performance.now();
 try{
  const options={maxFields:budget,maxLabels:limit},p=method==='live-frontier'?planLiveFrontier(workload.steps,workload.history,options):planBudgeted(workload.steps,workload.history,{...options,strategy:method==='greedy'?'greedy':'frontier'});
  parentPort.postMessage({status:p.feasible?'optimal-candidate':'infeasible',elapsedMs:performance.now()-started,tuple:p.feasible?[p.newDisclosures.length,p.work,p.fields]:null,path:p.path?.map(a=>a.id),peak:p.peak,visited:p.visited,width:p.width,newDisclosures:p.newDisclosures});
 }catch(e){parentPort.postMessage({status:e.message==='FRONTIER_BOUND_EXCEEDED'?'label-limit':'error',error:e.message,elapsedMs:performance.now()-started,peak:e.peak,visited:e.visited,width:e.width});}
});
