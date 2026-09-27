import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
export function nativeTau({python=process.env.TAU_PYTHON||resolve('data/research/v10-python',process.platform==='win32'?'Scripts/python.exe':'bin/python')}={}){
 const processHandle=spawn(python,['scripts/native_tau_bridge.py'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 const pending=[];let stderr='',fatal=null,closed=false;
 const completion=new Promise(resolve=>processHandle.once('close',()=>{closed=true;resolve();}));
 processHandle.stderr.on('data',x=>{stderr=(stderr+x.toString()).slice(-4000);});
 const lines=createInterface({input:processHandle.stdout});
 lines.on('line',line=>{const p=pending.shift();if(!p)return;try{const data=JSON.parse(line);data.ok?p.resolve(data.result):p.reject(Error(data.error));}catch(e){p.reject(e);}});
 const fail=error=>{while(pending.length)pending.shift().reject(error);};
 processHandle.on('error',error=>{fatal=error;fail(error);});
 processHandle.stdin.on('error',error=>{fatal=error;fail(error);});
 processHandle.on('exit',code=>{fatal=Error('NATIVE_EXIT '+code+' '+stderr);if(pending.length)fail(fatal);});
 return {call:message=>new Promise((resolve,reject)=>{if(fatal||closed){reject(fatal||Error('NATIVE_CLOSED'));return;}pending.push({resolve,reject});processHandle.stdin.write(JSON.stringify(message)+'\n');}),
  close:()=>{if(!closed)processHandle.stdin.end();return completion;}};
}
