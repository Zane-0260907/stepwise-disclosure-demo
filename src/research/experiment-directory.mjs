import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Only the new-run wrapper uses this. Frozen runners remain byte-identical.
export async function claimExperimentDirectory(parent, id, protocol) {
  if (!/^[a-zA-Z0-9_-]{1,90}$/.test(id)) throw Error('Invalid run-id');
  if (/^(?:v[1-4]-|frozen-)/.test(id)) throw Error('Reserved published/development run-id; use a new name');
  const directory = new URL(`${id}/`, parent);
  await mkdir(directory, { recursive: true });
  const lock = new URL('running.lock', directory);
  let handle;
  try {
    handle = await open(lock, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw Error('RUN_LOCKED: check the existing process before removing running.lock');
    throw error;
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await handle.close();
    await unlink(lock);
  };
  try {
    let previous = null;
    try {
      previous = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (previous) {
      assert.deepEqual(previous.protocol, protocol, 'RESUME_PROTOCOL_MISMATCH: use a new run-id');
    } else {
      try {
        await readFile(new URL('scores.jsonl', directory));
        throw Error('RESUME_WITHOUT_MANIFEST: use a new run-id');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return { directory, previous, release };
  } catch (error) {
    await release();
    throw error;
  }
}
