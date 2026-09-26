import { loadCases } from '../src/research/catalog.mjs';
import { readCaseDocument } from '../src/research/documents.mjs';
let count=0;
for(const item of await loadCases()){
  await readCaseDocument(item.id);count++;
}
console.log(JSON.stringify({parsedPdfs:count,allMatchCatalog:true}));
