import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { claimExperimentDirectory } from '../src/research/experiment-directory.mjs';

test('fresh experiment directories preserve published runs and prevent concurrent/mismatched resumes', async () => {
  const parent = pathToFileURL(await mkdtemp(join(tmpdir(), 'stepwise-run-test-')) + sep);
  const protocol = { id: 'v4-finqa-example', hashes: { source: 'abc' } };
  await assert.rejects(claimExperimentDirectory(parent, '../escape', protocol), /Invalid/);
  await assert.rejects(claimExperimentDirectory(parent, 'v4-finqa-20260927', protocol), /Reserved/);
  const first = await claimExperimentDirectory(parent, 'my-experiment', protocol);
  await assert.rejects(claimExperimentDirectory(parent, 'my-experiment', protocol), /RUN_LOCKED/);
  const manifest = JSON.stringify({ protocol, startedAt: '2026-09-27T00:00:00Z' });
  await writeFile(new URL('manifest.json', first.directory), manifest);
  await first.release();
  await assert.rejects(claimExperimentDirectory(parent, 'my-experiment', { ...protocol, id: 'other' }), /RESUME_PROTOCOL_MISMATCH/);
  assert.equal(await readFile(new URL('manifest.json', first.directory), 'utf8'), manifest);
  const resumed = await claimExperimentDirectory(parent, 'my-experiment', protocol);
  assert.equal(resumed.previous.startedAt, '2026-09-27T00:00:00Z');
  await resumed.release();
  await writeFile(new URL('manifest.json', first.directory), '{}');
  await assert.rejects(claimExperimentDirectory(parent, 'my-experiment', protocol), /RESUME_PROTOCOL_MISMATCH/);
});
