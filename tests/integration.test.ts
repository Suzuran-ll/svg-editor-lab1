import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const executable = join(project, 'dist/src/main.js');

function workspace(t: TestContext): string {
  mkdirSync(join(project, '.tmp'), { recursive: true });
  const path = mkdtempSync(join(project, '.tmp', 'integration-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

function quoted(path: string): string { return JSON.stringify(relative(project, path)); }

function run(commands: string | readonly string[], expectedErrors = 0) {
  const input = typeof commands === 'string' ? commands : commands.join('\n');
  const result = spawnSync(process.execPath, [executable], {
    cwd: project, input: `${input}\n`, encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const errors = result.stderr.split(/\r?\n/).filter(Boolean);
  assert.equal(errors.length, expectedErrors, `Unexpected CLI errors:\n${result.stderr}\n${result.stdout}`);
  for (const line of errors) assert.match(line, /^error: /);
  return { ...result, errors };
}

function document(path: string) {
  return new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'image/svg+xml');
}

function shape(path: string, id: string) {
  const found = Array.from(document(path).getElementsByTagName('*')).find(element => element.getAttribute('id') === id);
  assert.ok(found, `Missing ${id} in ${path}`);
  return found;
}

function attributes(path: string, id: string): Record<string, string> {
  return Object.fromEntries(Array.from(shape(path, id).attributes).map(attribute => [attribute.name, attribute.value]));
}

function children(path: string, id?: string): string[] {
  const parent = id === undefined ? document(path).documentElement! : shape(path, id);
  return Array.from(parent.childNodes).filter(node => node.nodeType === 1).map(node => {
    const element = node as ReturnType<typeof shape>;
    return element.getAttribute('id')!;
  });
}

function fixture(path: string, content = '<rect id="existing" x="1" y="2" width="3" height="4"/>'): void {
  writeFileSync(path, `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${content}</svg>`);
}

test('help is available before initialization; document commands recover from missing document', () => {
  const result = run(['help', 'tree', 'canvas', 'show absent', 'undo', 'save', 'init', 'canvas'], 5);
  assert.match(result.stdout, /svg-editor/);
  for (const command of ['init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set', 'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo', 'help']) {
    assert.match(result.stdout, new RegExp(`(?:^|\\n)${command}(?: |\\n)`));
  }
  assert.match(result.stdout, /canvas 800x600/);
  result.errors.forEach(line => assert.match(line, /no document/));
});

test('six built-in types, optional colors, recursive move/scale and inherited group style', t => {
  const output = join(workspace(t), 'all.svg');
  run([
    'init 800 600', 'create g all',
    'create rect r 1 2 3 4 #ffffff in all',
    'create circle c 5 6 7 red in all',
    'create ellipse e 8 9 10 11 in all',
    'create line l 12 13 14 15 black in all',
    'create text t 16 17 "中文 title" in all',
    'set all fill blue', 'set all stroke-width 3',
    'move all -1 2', 'scale all 2', `save ${quoted(output)}`,
  ]);
  assert.deepEqual(attributes(output, 'r'), { id: 'r', x: '0', y: '8', width: '6', height: '8', fill: '#ffffff' });
  assert.deepEqual(attributes(output, 'c'), { id: 'c', cx: '8', cy: '16', r: '14', fill: 'red' });
  assert.deepEqual(attributes(output, 'e'), { id: 'e', cx: '14', cy: '22', rx: '20', ry: '22' });
  assert.deepEqual(attributes(output, 'l'), { id: 'l', x1: '22', y1: '30', x2: '26', y2: '34', stroke: 'black' });
  assert.deepEqual(attributes(output, 't'), { id: 't', x: '30', y: '38' });
  assert.equal(shape(output, 't').textContent, '中文 title');
  assert.equal(attributes(output, 'all')['stroke-width'], '3');
  assert.equal(attributes(output, 'all').fill, 'blue');
  assert.deepEqual(children(output, 'all'), ['r', 'c', 'e', 'l', 't']);
});

test('set enforces each shape attribute whitelist and preserves failed changes', t => {
  const output = join(workspace(t), 'attributes.svg');
  run([
    'init', 'create rect r -1 -2 0 4', 'set r width 8', 'set r height 9', 'set r fill #123456', 'set r stroke black', 'set r stroke-width 2.5',
    'create circle c 0 0 0', 'set c cx -5', 'set c cy 7', 'set c r 3',
    'create ellipse e 0 0 0 0', 'set e rx 3', 'set e ry 4',
    'create line l 0 0 0 0', 'set l x1 -1', 'set l y1 -2', 'set l x2 3', 'set l y2 4',
    'create text t 0 0 ""', 'set t x 5', 'set t y 6', 'set t text "new text"',
    'create g g', 'set g stroke red',
    'set r cx 1', 'set c width 1', 'set e r 1', 'set l text nope', 'set t font-size 12', 'set g x 1', 'set r id changed', 'set r width -1',
    `save ${quoted(output)}`,
  ], 8);
  assert.equal(attributes(output, 'r').width, '8');
  assert.equal(attributes(output, 'r').height, '9');
  assert.equal(attributes(output, 'r')['stroke-width'], '2.5');
  assert.equal(attributes(output, 'r').fill, '#123456');
  assert.deepEqual(attributes(output, 'c'), { id: 'c', cx: '-5', cy: '7', r: '3' });
  assert.deepEqual(attributes(output, 'e'), { id: 'e', cx: '0', cy: '0', rx: '3', ry: '4' });
  assert.deepEqual(attributes(output, 'l'), { id: 'l', x1: '-1', y1: '-2', x2: '3', y2: '4' });
  assert.equal(shape(output, 't').textContent, 'new text');
  assert.deepEqual(attributes(output, 'g'), { id: 'g', stroke: 'red' });
});

test('invalid numbers, dimensions, IDs and missing containers leave document and redo intact', t => {
  const output = join(workspace(t), 'validation.svg');
  const result = run([
    'init', 'create rect r 1 2 3 4', 'move r 5 6', 'undo',
    'create rect r 0 0 1 1', 'create circle bad 0 0 -1', 'create ellipse bad 0 0 -1 2',
    'create rect bad 0 0 -1 2', 'create rect bad NaN 0 1 1', 'create line bad 0 Infinity 1 2',
    'create rect "" 0 0 1 1', 'create rect "bad id" 0 0 1 1',
    'create rect bad 0 0 1 1 in missing', 'create rect bad 0 0 1 1 in r',
    'move missing 1 1', 'move r 1e309 0', 'scale r 0', 'scale r -2',
    'set r width Infinity', 'delete missing', 'create box future 0 0 1 1',
    'redo', `save ${quoted(output)}`,
  ], 17);
  assert.equal(attributes(output, 'r').x, '6');
  assert.equal(attributes(output, 'r').y, '8');
  assert.deepEqual(children(output), ['r']);
  assert.match(result.stderr, /plugin loaded/);
});

test('undo and redo restore deep snapshots after moving, setting and deleting a group', t => {
  const output = join(workspace(t), 'snapshots.svg');
  run([
    'init', 'create g g', 'create rect r 1 2 3 4 red in g',
    'move g 10 20', 'set r fill blue', 'delete g', 'undo', 'undo', 'undo',
    'redo', 'redo', 'redo', 'undo', `save ${quoted(output)}`,
  ]);
  assert.equal(attributes(output, 'r').x, '11');
  assert.equal(attributes(output, 'r').y, '22');
  assert.equal(attributes(output, 'r').fill, 'blue');
  assert.deepEqual(children(output, 'g'), ['r']);
});

test('tree, show, help and canvas inquiries preserve redo; a new edit clears it', t => {
  const dir = workspace(t);
  const first = join(dir, 'inquiries.svg');
  const result = run([
    'init', 'create rect r 1 2 3 4', 'move r 10 0', 'undo',
    'tree', 'tree r', 'show r', 'canvas', 'help', 'redo', `save ${quoted(first)}`,
  ]);
  assert.equal(attributes(first, 'r').x, '11');
  assert.match(result.stdout, /parent=svg/);
  const second = join(dir, 'new-edit.svg');
  run(['init', 'create rect r 1 2 3 4', 'move r 10 0', 'undo', 'set r fill blue', 'redo', `save ${quoted(second)}`], 1);
  assert.equal(attributes(second, 'r').x, '1');
  assert.equal(attributes(second, 'r').fill, 'blue');
});

test('successful init/read/save/canvas resize lock both histories until the next edit', async t => {
  const dir = workspace(t);
  const imported = join(dir, 'import.svg');
  fixture(imported);
  const boundaries = ['init 900 700', `read ${quoted(imported)}`, `save ${quoted(join(dir, 'save.svg'))}`, 'canvas 900 700'];
  for (const [index, boundary] of boundaries.entries()) {
    await t.test(boundary.split(' ')[0]!, () => {
      const output = join(dir, `boundary-${index}.svg`);
      const result = run([
        'init', 'create rect r 1 2 3 4', 'move r 1 1', 'undo', boundary,
        'undo', 'redo', 'create circle fresh 10 20 30', 'undo', 'redo', `save ${quoted(output)}`,
      ], 2);
      result.errors.forEach(line => assert.match(line, /after io command/));
      assert.equal(attributes(output, 'fresh').r, '30');
    });
  }
});

test('failed I/O and invalid canvas/init leave both current document and redo untouched', t => {
  const dir = workspace(t);
  const broken = join(dir, 'broken.svg');
  writeFileSync(broken, '<svg><rect></svg>');
  const output = join(dir, 'preserved.svg');
  run([
    'init', 'create rect r 1 2 3 4', 'move r 10 0', 'undo',
    `read ${quoted(join(dir, 'missing.svg'))}`, `read ${quoted(broken)}`,
    `save ${quoted(join(dir, 'missing-directory', 'output.svg'))}`, 'save',
    'init 0 600', 'canvas -1 500', 'canvas 200', 'redo', `save ${quoted(output)}`,
  ], 7);
  assert.equal(attributes(output, 'r').x, '11');
  assert.equal(document(output).documentElement!.getAttribute('width'), '800');
});

test('cross-parent grouping uses traversal order and nearest common ancestor placement', t => {
  const output = join(workspace(t), 'grouping.svg');
  run([
    'init', 'create g root', 'create g left in root',
    'create rect a 0 0 1 1 in left', 'create rect keep 0 0 1 1 in left',
    'create g right in root', 'create circle b 0 0 1 in right',
    'group combined b a', `save ${quoted(output)}`,
  ]);
  assert.deepEqual(children(output, 'root'), ['combined', 'left', 'right']);
  assert.deepEqual(children(output, 'combined'), ['a', 'b']);
  assert.deepEqual(children(output, 'left'), ['keep']);
  assert.deepEqual(children(output, 'right'), []);
});

test('nested ungroup replaces its slot; addto appends; front/back only change sibling order', t => {
  const output = join(workspace(t), 'order.svg');
  run([
    'init', 'create g root', 'create rect a 0 0 1 1 in root',
    'create g inner in root', 'create rect b 0 0 1 1 in inner', 'create rect c 0 0 1 1 in inner',
    'create rect d 0 0 1 1 in root', 'ungroup inner',
    'front b', 'back d', 'create g target', 'addto target c', 'undo', 'redo',
    `save ${quoted(output)}`,
  ]);
  assert.deepEqual(children(output), ['root', 'target']);
  assert.deepEqual(children(output, 'root'), ['d', 'a', 'b']);
  assert.deepEqual(children(output, 'target'), ['c']);
});

test('grouping cycles, duplicate selections and root ungroup errors retain a usable redo', t => {
  const output = join(workspace(t), 'cycles.svg');
  run([
    'init', 'create g root', 'create g inner in root', 'create rect a 0 0 1 1 in inner',
    'create rect b 0 0 1 1 in root', 'move a 4 5', 'undo',
    'group bad a a', 'group bad inner a', 'addto inner root', 'addto root root',
    'ungroup root', 'ungroup a', 'group root a b', 'group bad a missing', 'group bad a',
    'redo', `save ${quoted(output)}`,
  ], 9);
  assert.deepEqual(children(output, 'root'), ['inner', 'b']);
  assert.deepEqual(children(output, 'inner'), ['a']);
  assert.equal(attributes(output, 'a').x, '4');
  assert.equal(attributes(output, 'a').y, '5');
});

test('undo/redo round-trip tree edits without losing parent or sibling positions', t => {
  const output = join(workspace(t), 'tree-history.svg');
  run([
    'init', 'create g root', 'create rect a 0 0 1 1 in root', 'create rect b 0 0 1 1 in root', 'create rect c 0 0 1 1 in root',
    'group nested c a', 'undo', 'redo', 'ungroup nested', 'undo', 'redo',
    'back b', 'undo', 'redo', 'front a', 'undo', 'redo', `save ${quoted(output)}`,
  ]);
  assert.deepEqual(children(output, 'root'), ['b', 'c', 'a']);
});

test('default save path follows successful save/read and is cleared by init', t => {
  const dir = workspace(t);
  const first = join(dir, 'first.svg');
  const second = join(dir, 'second.svg');
  fixture(second);
  const result = run([
    'init', 'create rect r 0 0 1 1', `save ${quoted(first)}`, 'move r 10 0', 'save',
    `read ${quoted(second)}`, 'move existing 20 0', 'save', 'init', 'save',
  ], 1);
  assert.equal(attributes(first, 'r').x, '10');
  assert.equal(attributes(second, 'existing').x, '21');
  assert.match(result.stderr, /no file path/);
});

test('quoted paths, escaped quotes, Chinese, XML entities, empty text and hash colors round-trip', t => {
  const dir = workspace(t);
  const first = join(dir, '文件 with spaces.svg');
  const second = join(dir, 'roundtrip.svg');
  run([
    '  # this whole line is ignored', '', 'init',
    'create text title 10 20 "中文 & <tag> \\"quoted\\" \\\\ path"',
    'create text empty 0 0 ""', 'create text literal 0 0 "in"',
    'create rect r 0 0 1 1 #ffffff', `save ${quoted(first)}`, `read ${quoted(first)}`, `save ${quoted(second)}`,
  ]);
  assert.equal(shape(second, 'title').textContent, '中文 & <tag> "quoted" \\ path');
  assert.equal(shape(second, 'empty').textContent, '');
  assert.equal(shape(second, 'literal').textContent, 'in');
  assert.equal(attributes(second, 'r').fill, '#ffffff');
  assert.match(readFileSync(first, 'utf8'), /&amp;/);
  assert.match(readFileSync(first, 'utf8'), /&lt;tag/);
});

test('parser errors are one line each and do not corrupt later commands', t => {
  const output = join(workspace(t), 'parser.svg');
  run([
    'init', 'create rect r 0 0 1 1', 'move r 7 8', 'undo',
    'create text t 0 0 "unterminated', 'create text t 0 0 "text"trailing',
    'create text t 0 0 ab"cd', 'unknown-command', 'undo extra', 'move r 1',
    'redo', `save ${quoted(output)}`,
  ], 6);
  assert.equal(attributes(output, 'r').x, '7');
  assert.equal(attributes(output, 'r').y, '8');
});

test('import precollects explicit IDs before filling missing IDs; IDs are case sensitive', t => {
  const dir = workspace(t);
  const imported = join(dir, 'missing-ids.svg');
  const output = join(dir, 'ids.svg');
  fixture(imported, '<rect width="1" height="2"/><g><circle r="3"/></g><rect id="rect1" width="4" height="5"/><rect id="R"/><rect id="r"/>');
  const result = run([`read ${quoted(imported)}`, `save ${quoted(output)}`]);
  assert.deepEqual(children(output), ['rect2', 'g1', 'rect1', 'R', 'r']);
  assert.deepEqual(children(output, 'g1'), ['circle1']);
  assert.match(result.stdout, /rect2/);
  assert.match(result.stdout, /circle1/);
  assert.equal(attributes(output, 'rect2').width, '1');
});

test('unsupported SVG and duplicate IDs fail atomically without publishing auto-ID warnings', t => {
  const dir = workspace(t);
  const badBodies = [
    '<rect/><circle id="same"/><rect id="same"/>',
    '<rect/><path id="bad" d="M0 0 L1 1"/>',
    '<rect/><g id="bad" transform="translate(10 20)"/>',
    '<rect/><rect id="bad" style="fill:red"/>',
    '<rect/><text id="bad"><tspan>unsupported</tspan></text>',
  ];
  const files = badBodies.map((body, index) => {
    const file = join(dir, `bad-${index}.svg`); fixture(file, body); return file;
  });
  const viewBox = join(dir, 'viewbox.svg');
  writeFileSync(viewBox, '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="10 0 800 600"/>');
  const output = join(dir, 'import-preserved.svg');
  const result = run([
    'init', 'create rect r 1 2 3 4', 'move r 10 0', 'undo',
    ...files.map(file => `read ${quoted(file)}`), `read ${quoted(viewBox)}`, 'redo', `save ${quoted(output)}`,
  ], files.length + 1);
  assert.doesNotMatch(result.stdout, /warning:/i);
  assert.equal(attributes(output, 'r').x, '11');
  assert.deepEqual(children(output), ['r']);
});

test('CLI rejects file paths outside the project and still accepts a later valid save', t => {
  const output = join(workspace(t), 'inside.svg');
  run(['init', 'create rect r 0 0 1 1', 'save ../outside.svg', 'read ../outside.svg', `save ${quoted(output)}`], 2);
  assert.deepEqual(children(output), ['r']);
});

test('assignment section 6 replay preserves edited SVG and imports seven example elements', t => {
  const output = join(workspace(t), 'demo.svg');
  const script = readFileSync(join(project, 'examples/demo.commands'), 'utf8').replace('save .tmp/demo.svg', `save ${quoted(output)}`);
  const result = run(script, 2);
  assert.match(result.stderr, /markers/);
  assert.match(result.stderr, /after io command/);
  assert.equal(attributes(output, 'c1').cx, '130');
  assert.equal(shape(output, 'title').textContent, 'My Diagram');
  assert.deepEqual(children(output, 'markers'), ['c1', 'box']);
  assert.match(result.stdout, /7 elements/);
  assert.match(result.stdout, /rect1/);
});

test('assignment section 6.1 flowchart exports expected structure after undo and text editing', t => {
  const output = join(workspace(t), 'flowchart.svg');
  const script = readFileSync(join(project, 'examples/flowchart.commands'), 'utf8').replace('save .tmp/flowchart.svg', `save ${quoted(output)}`);
  run(script);
  assert.deepEqual(children(output), ['flowchart']);
  assert.deepEqual(children(output, 'flowchart'), ['node1', 'node2', 'arrow1']);
  assert.deepEqual(children(output, 'node1'), ['start', 'start-label']);
  assert.deepEqual(children(output, 'node2'), ['process', 'process-label']);
  assert.equal(attributes(output, 'process').y, '100');
  assert.equal(attributes(output, 'process-label').y, '135');
  assert.equal(shape(output, 'process-label').textContent, '处理数据 v2');
  assert.equal(attributes(output, 'arrow1').x2, '520');
});
