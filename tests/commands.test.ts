import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { CommandHistory } from '../src/commands/CommandHistory.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { ScaleCommand } from '../src/commands/ScaleCommand.js';
import { GroupCommand } from '../src/commands/GroupCommand.js';
import { DeleteCommand } from '../src/commands/DeleteCommand.js';
import { SetCommand } from '../src/commands/SetCommand.js';
import { Tokenizer } from '../src/cli/Tokenizer.js';

test('history snapshots isolate caller mutations and restore complete document state', () => {
  const history = new CommandHistory();
  const original = new SvgDocument();
  original.add(ShapeFactory.create('rect', 'r', ['1', '2', '3', '4']));
  const moved = history.execute(new MoveCommand('r', 10, 20), original).document;
  assert.equal(original.find('r').getAttributes().x, '1');
  moved.find('r').move(100, 100);
  assert.equal(history.undo().document.find('r').getAttributes().x, '1');
  assert.equal(history.redo().document.find('r').getAttributes().x, '11');
});

test('failed edits preserve redo and original geometry', () => {
  const history = new CommandHistory();
  const first = history.execute(new CreateCommand('rect', 'r', ['1', '2', '3', '4']), new SvgDocument()).document;
  history.execute(new MoveCommand('r', 10, 0), first);
  const undone = history.undo().document;
  assert.throws(() => history.execute(new ScaleCommand('r', -1), undone), /scale factor must be positive/);
  assert.equal(undone.find('r').getAttributes().x, '1');
  assert.equal(history.redo().document.find('r').getAttributes().x, '11');
});

test('reusing a successful command cannot overwrite snapshots already in history', () => {
  const history = new CommandHistory();
  const document = new SvgDocument();
  document.add(ShapeFactory.create('rect', 'r', ['0', '0', '1', '1']));
  const move = new MoveCommand('r', 1, 0);
  const moved = history.execute(move, document).document;
  assert.throws(() => history.execute(move, moved), /already been executed/);
  assert.equal(history.undo().document.find('r').getAttributes().x, '0');
  assert.throws(() => history.undo(), /nothing to undo/);
  assert.equal(history.redo().document.find('r').getAttributes().x, '1');
});

test('successful new edit clears redo; IO clears and locks both stacks', () => {
  const history = new CommandHistory();
  let document = history.execute(new CreateCommand('g', 'g', []), new SvgDocument()).document;
  document = history.undo().document;
  document = history.execute(new CreateCommand('g', 'other', []), document).document;
  assert.throws(() => history.redo(), /nothing to redo/);
  history.resetAfterIo();
  assert.throws(() => history.undo(), /undo not allowed after io command/);
  assert.throws(() => history.redo(), /undo not allowed after io command/);
  assert.throws(() => history.execute(new DeleteCommand('missing'), document), /no such shape/);
  assert.throws(() => history.undo(), /undo not allowed after io command/);
  history.execute(new CreateCommand('g', 'new', []), document);
  assert.equal(history.undo().document.count(), 1);
  assert.throws(() => history.undo(), /nothing to undo/);
});

test('group and subtree deletion each form one undo unit', () => {
  const history = new CommandHistory();
  const document = new SvgDocument();
  document.add(ShapeFactory.create('rect', 'a', ['0', '0', '10', '10']));
  document.add(ShapeFactory.create('circle', 'b', ['5', '5', '2']));
  const grouped = history.execute(new GroupCommand('g', ['b', 'a']), document).document;
  assert.deepEqual(grouped.find('g').getChildren().map(shape => shape.id), ['a', 'b']);
  const deleted = history.execute(new DeleteCommand('g'), grouped).document;
  assert.equal(deleted.count(), 0);
  assert.equal(history.undo().document.count(), 3);
  assert.deepEqual(history.undo().document.getChildren().map(shape => shape.id), ['a', 'b']);
});

test('partially overflowing group transformations cannot leak into live document', () => {
  const history = new CommandHistory();
  const document = new SvgDocument();
  document.add(ShapeFactory.create('g', 'g', []));
  document.add(ShapeFactory.create('rect', 'normal', ['1', '2', '3', '4']), 'g');
  document.add(ShapeFactory.create('circle', 'huge', ['1e308', '0', '1']), 'g');
  assert.throws(() => history.execute(new ScaleCommand('g', 10), document));
  assert.equal(document.find('normal').getAttributes().x, '1');
  assert.equal(document.find('huge').getAttributes().cx, '1e+308');
});

test('invalid set never damages a previous state or redo', () => {
  const history = new CommandHistory();
  const document = new SvgDocument();
  document.add(ShapeFactory.create('text', 't', ['1', '2', 'old']));
  history.execute(new SetCommand('t', 'text', 'new'), document);
  const old = history.undo().document;
  assert.throws(() => history.execute(new SetCommand('t', 'id', 'other'), old), /unknown attribute: id/);
  assert.equal(history.redo().document.find('t').getText(), 'new');
});

test('tokenizer preserves empty strings, quoted in and colors; rejects broken quotes', () => {
  const lexer = new Tokenizer();
  assert.deepEqual(lexer.tokenize('  # comment'), []);
  assert.deepEqual(lexer.tokenize('set r fill #ffffff').map(token => token.value), ['set', 'r', 'fill', '#ffffff']);
  assert.equal(lexer.tokenize('create text t 0 0 ""').at(-1)?.value, '');
  assert.deepEqual(lexer.tokenize('"in" "a \\"quote\\" \\\\ b"'), [
    { value: 'in', quoted: true }, { value: 'a "quote" \\ b', quoted: true },
  ]);
  assert.throws(() => lexer.tokenize('set t text "unfinished'), /unterminated/);
});
