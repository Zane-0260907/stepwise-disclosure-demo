import { extractPdfText } from '../pdf.mjs';
import { getCase, LABELS } from './catalog.mjs';
export async function readCaseDocument(id){
  const item=await getCase(id);
  const file=new URL(`../../fixtures/research/documents/${item.source}`,import.meta.url);
  const pdf=await extractPdfText(file);const facts={};
  const sections=[...pdf.text.matchAll(/\[\[([a-z_]+)\]\]([\s\S]*?)(?=\[\[|$)/g)];
  for(const match of sections){
    const key=match[1];if(key==='end')continue;
    // Each field is a JSON value followed by the next display label; stop at that label.
    let value=match[2].trim();
    const nextLabels=Object.values(LABELS).map(pair=>pair[0]);
    for(const label of nextLabels)if(value.endsWith(label))value=value.slice(0,-label.length).trim();
    facts[key]=JSON.parse(value.replace(/\r?\n/g,''));
  }
  if(JSON.stringify(facts)!==JSON.stringify(item.facts))throw new Error(`PDF_INPUT_MISMATCH: ${id} 文档与已登记输入不一致`);
  return {...item,facts,document:{file:item.source,sha256:pdf.sha256,bytes:pdf.bytes,pages:pdf.pages}};
}
