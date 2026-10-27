import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('CLI accepts help and exits cleanly on EOF', () => {
  const result = spawnSync(process.execPath, ['dist/src/main.js'], { input: 'help\n', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /svg-editor 0.1/);
  assert.doesNotMatch(result.stdout, /error:/);
});
