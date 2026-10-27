import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorApplication } from '../src/application/EditorApplication.js';
import type { DocumentStore } from '../src/application/DocumentStore.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { Rect } from '../src/domain/Rect.js';

test('failed read/save-as/init preserve the remembered save path, document and pending redo', async () => {
  const written: { path: string; document: SvgDocument }[] = [];
  const store: DocumentStore = {
    async read() { throw new Error('simulated read failure'); },
    async write(path, document) {
      if (path === 'blocked.svg') throw new Error('simulated write failure');
      written.push({ path, document: document.clone() });
    },
  };
  const app = new EditorApplication(store);
  app.init();
  app.edit(new CreateCommand('rect', 'r', ['1', '2', '3', '4']));
  await app.save('original.svg');
  app.edit(new MoveCommand('r', 10, 20));
  app.undo();
  await assert.rejects(app.save('blocked.svg'), /simulated write failure/);
  await assert.rejects(app.read('unreadable.svg'), /simulated read failure/);
  assert.throws(() => app.init(0, 600), /positive/);
  assert.match(app.show('r'), /x=1 y=2/);
  app.redo();
  assert.match(app.show('r'), /x=11 y=22/);
  await app.save();
  assert.deepEqual(written.map(entry => entry.path), ['original.svg', 'original.svg']);
  assert.equal(written.at(-1)!.document.find('r').getAttributes().x, '11');
});

test('successful save-as replaces the default path; successful read supplies warnings and the new default', async () => {
  const written: string[] = [];
  const imported = new SvgDocument(320, 240);
  imported.add(new Rect('rect1', 1, 2, 3, 4));
  const store: DocumentStore = {
    async read() { return { document: imported.clone(), warnings: ['warning: assigned id rect1'] }; },
    async write(path) { written.push(path); },
  };
  const app = new EditorApplication(store);
  app.init();
  await app.save('first.svg');
  await app.save('second.svg');
  await app.save();
  const messages = await app.read('imported.svg');
  assert.deepEqual(messages, ['warning: assigned id rect1', 'read imported.svg (1 elements)']);
  assert.equal(app.canvas(), 'canvas 320x240');
  await app.save();
  assert.deepEqual(written, ['first.svg', 'second.svg', 'second.svg', 'imported.svg']);
  app.init();
  await assert.rejects(app.save(), /no file path/);
});
