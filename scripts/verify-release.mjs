import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'FILES.sha256.json'), 'utf8'));
const failures = [];
for (const [file, expected] of Object.entries(manifest)) {
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    failures.push(`${file}: path outside the release`);
    continue;
  }
  try {
    const actual = createHash('sha256').update(await readFile(target)).digest('hex');
    if (actual !== expected) failures.push(`${file}: checksum mismatch`);
  } catch (error) {
    failures.push(`${file}: ${error.code}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ verifiedReleaseFiles: Object.keys(manifest).length, algorithm: 'SHA-256' }));
}
