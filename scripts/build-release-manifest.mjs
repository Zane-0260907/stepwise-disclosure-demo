// Hash the staged Git bytes, not a platform's CRLF working-copy expansion.
// Stage the intended release first, run this, then stage FILES.sha256.json.
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(f=>f&&f!=='FILES.sha256.json').sort();
const manifest={};
for(const file of files){
 const bytes=execFileSync('git',['show',':'+file],{cwd:root,maxBuffer:128*1024*1024});
 manifest[file]=createHash('sha256').update(bytes).digest('hex');
}
await writeFile(new URL('../FILES.sha256.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({stagedFiles:files.length}));
