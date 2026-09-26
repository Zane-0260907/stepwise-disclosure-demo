import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CMAPS = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'cmaps').replaceAll('\\', '/') + '/';

export function textLines(items) {
  const lines = new Map();
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5]);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push(item.str);
  }
  return [...lines].sort(([a], [b]) => b - a).map(([, parts]) => parts.join('')).join('\n');
}

export async function extractPdfText(filePath) {
  const file = await readFile(filePath);
  const task = getDocument({ data: new Uint8Array(file), cMapUrl: CMAPS, cMapPacked: true });
  const document = await task.promise;
  try {
    const chunks = [];
    for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
      const page = await document.getPage(pageNo);
      const content = await page.getTextContent();
      chunks.push(textLines(content.items));
    }
    return { text: chunks.join('\n'), bytes: file.length, sha256: createHash('sha256').update(file).digest('hex'), pages: document.numPages };
  } finally {
    await task.destroy();
  }
}
