import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function createTransport(onReceipt=()=>{}) {
  const token=randomUUID();
  const worker=fork(fileURLToPath(new URL('./receiver-worker.mjs',import.meta.url)),[],{env:{...process.env,RECEIVER_TOKEN:token},stdio:['ignore','ignore','ignore','ipc']});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Receiver startup timed out')),15000);
    worker.on('message',(message)=>{
      if(message.type==='ready'){clearTimeout(timer);resolve(message.port);}
      if(message.type==='receipt') onReceipt(message.receipt);
    });
    worker.once('error',(error)=>{clearTimeout(timer);reject(error);});
    worker.once('exit',(code)=>{clearTimeout(timer);reject(new Error(`Receiver exited: ${code}`));});
  });
  return { pid:worker.pid, close:()=>worker.kill(), async send(run,step,payload,recipient) {
    const response=await fetch(`http://127.0.0.1:${port}/${recipient==='cloud-model'?'model':'reference'}`,{
      method:'POST',headers:{'content-type':'application/json','x-receiver-token':token,'x-run-id':run.id,'x-step-id':step.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(95000),
    });
    const envelope=await response.json();
    if(!response.ok) throw Object.assign(new Error(envelope.error||`Receiver HTTP ${response.status}`),{receipt:envelope.receipt});
    return envelope;
  }};
}
