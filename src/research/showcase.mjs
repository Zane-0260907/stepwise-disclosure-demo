import { readFile } from 'node:fs/promises';
import { extractPdfText } from '../pdf.mjs';
import { LABELS } from './catalog.mjs';
export async function showcaseCases(){try{return JSON.parse(await readFile(new URL('../../fixtures/showcase/cases.json',import.meta.url),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
export async function readShowcaseDocument(id){
 const item=(await showcaseCases()).find(c=>c.id===id);if(!item)throw new Error('Unknown showcase');
 const pdf=await extractPdfText(new URL(`../../fixtures/showcase/documents/${item.source}`,import.meta.url));
 const facts={};for(const match of pdf.text.matchAll(/\[\[([a-z_]+)\]\]([\s\S]*?)(?=\[\[|$)/g)){
  const key=match[1];if(key==='end')continue;let value=match[2].trim();
  for(const label of Object.values(LABELS).map(x=>x[0]))if(value.endsWith(label))value=value.slice(0,-label.length).trim();
  facts[key]=JSON.parse(value.replace(/\r?\n/g,''));
 }
 if(JSON.stringify(facts)!==JSON.stringify(item.facts))throw new Error('SHOWCASE_PDF_MISMATCH');
 return {...item,facts,document:{file:item.source,sha256:pdf.sha256,bytes:pdf.bytes,pages:pdf.pages}};
}
