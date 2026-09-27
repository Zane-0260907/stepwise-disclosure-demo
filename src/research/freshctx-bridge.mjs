import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export function freshctxBridge(){
 const child=spawn(process.env.FRESHCTX_PYTHON||'python',[fileURLToPath(new URL('../../scripts/freshctx-boundary.py',import.meta.url))],{stdio:['pipe','pipe','inherit'],windowsHide:true});
 const pending=[];let dead=null;
 const fail=error=>{dead=error;for(const p of pending.splice(0))p.reject(error);};child.on('error',fail);child.on('exit',code=>{if(code!==0)fail(Error('FRESHCTX_EXIT:'+code));});
 createInterface({input:child.stdout}).on('line',line=>{const task=pending.shift();if(!task)return;try{const value=JSON.parse(line);if(value.integrationError)throw Error(value.integrationError);task.resolve(value);}catch(e){task.reject(e);}});
 return {check:request=>dead?Promise.reject(dead):new Promise((resolve,reject)=>{pending.push({resolve,reject});child.stdin.write(JSON.stringify(request)+'\n');}),close:()=>new Promise(resolve=>{child.once('exit',resolve);child.stdin.end();})};
}
