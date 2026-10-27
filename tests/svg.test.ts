import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import type { Shape } from '../src/domain/Shape.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { FileDocumentStore } from '../src/infrastructure/FileDocumentStore.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';

const codec = new SvgCodec();
test('SVG round trip preserves carriage returns from XML character references', () => {
  const first = codec.decode('<svg><text id="t">a&#13;b</text></svg>').document;
  assert.equal(first.find('t').getText(), 'a\rb');
  const saved = codec.encode(first);
  assert.match(saved, /&#13;/);
  assert.equal(codec.decode(saved).document.find('t').getText(), 'a\rb');
});

const svg = (content: string, attrs = ''): string => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${content}</svg>`;
const snapshot = (shape: Shape): unknown => ({
  tag: shape.tag, attributes: shape.getAttributes(), text: shape.getText(), children: shape.getChildren().map(snapshot),
});

test('SVG round trip preserves all six shapes, nested order, explicit styles, Chinese and XML text', () => {
  const source = svg(`
    <g id="layer" fill="#f5f5f5" stroke="blue" stroke-width="2">
      <rect id="r" x="-1" y="2" width="30" height="40" fill="red"/>
      <circle id="c" cx="5" cy="6" r="7"/>
      <g id="inner">
        <ellipse id="e" cx="10" cy="11" rx="12" ry="13"/>
        <line id="l" x1="1" y1="2" x2="3" y2="4"/>
        <text id="t" x="20" y="21" fill="black">中文 &amp; &lt; &gt; "引号"</text>
        <text id="empty" x="0" y="0"></text>
      </g>
    </g>
    <rect id="last&quot;quoted" x="1" y="2" width="3" height="4"/>`, 'width="1024px" height="768" viewBox="0, 0, 1024, 768"');
  const result = codec.decode(source);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.document.width, 1024);
  assert.equal(result.document.height, 768);
  assert.equal(result.document.find('t').getText(), '中文 & < > "引号"');
  const output = codec.encode(result.document);
  assert.match(output, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(output, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(output, /中文 &amp; &lt;/);
  assert.match(output, /id="last&quot;quoted"/);
  const decoded = codec.decode(output);
  assert.deepEqual(decoded.document.getChildren().map(snapshot), result.document.getChildren().map(snapshot));
  assert.equal(decoded.document.find('empty').getText(), '');
  assert.equal(decoded.document.width, 1024);
  assert.equal(decoded.document.height, 768);
});

test('SVG reserves later explicit IDs before assigning missing or empty IDs', () => {
  const result = codec.decode(svg('<rect/><g><rect id="rect1"/><rect id=""/></g><rect id="rect3"/>'));
  assert.deepEqual(result.document.getChildren().map(shape => shape.id), ['rect2', 'g1', 'rect3']);
  assert.deepEqual(result.document.find('g1').getChildren().map(shape => shape.id), ['rect1', 'rect4']);
  assert.deepEqual(result.warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id g1 to unnamed <g>',
    'warning: assigned id rect4 to unnamed <rect>',
  ]);
  assert.ok(Object.isFrozen(result.warnings));
  assert.throws(() => codec.decode(svg('<rect id="a"/><g><circle id="a"/></g>')), /id already exists: a/);
});

test('SVG accepts minimal documents, comments, CDATA text and matching viewBox', () => {
  const result = codec.decode('<?xml version="1.0"?>\n<!-- document --><svg><text id="t"><![CDATA[ <中文> & ]]></text><!-- child --></svg>');
  assert.equal(result.document.width, 800);
  assert.equal(result.document.height, 600);
  assert.equal(result.document.find('t').getText(), ' <中文> & ');
  assert.equal(codec.decode(svg('', 'width="1e3" height=".5px" viewBox="0 0 1000 .5"')).document.height, 0.5);
  const declarationText = codec.decode(svg('<!-- <!DOCTYPE ignored> --><text id="t"><![CDATA[<!DOCTYPE text>]]></text>'));
  assert.equal(declarationText.document.find('t').getText(), '<!DOCTYPE text>');
});

test('SVG rejects malformed XML, DTDs and unsupported XML constructs', () => {
  for (const source of [
    '', '<svg><rect></svg>', '<svg/><svg/>', '<svg bad=no/>', '<svg><rect id="a" id="b"/></svg>',
    '<svg><text>&missing;</text></svg>', '<!DOCTYPE svg><svg/>',
    '<!DOCTYPE svg [<!ENTITY data "hello">]><svg/>', '<svg><?not-supported data?></svg>',
    '<?xml-stylesheet href="style.css"?><svg/>', '<html/>', 'not XML',
  ]) assert.throws(() => codec.decode(source), source);
});

test('SVG rejects unsupported structures, attributes, namespaces and coordinates without silent loss', () => {
  for (const source of [
    svg('<path id="p" d="M0 0"/>'), svg('<svg/>'), svg('<rect id="r" transform="translate(1 2)"/>'),
    svg('<g id="g" style="fill:red"/>'), svg('<rect id="r" opacity=".5"/>'), svg('<text><tspan>x</tspan></text>'),
    svg('<rect><circle/></rect>'), svg('<g>unexpected text</g>'), svg('unexpected root text'),
    svg('<rect width="10px"/>'), svg('<circle r="-1"/>'), svg('<text font-size="18"/>'), svg('<text font-family="Arial"/>'), svg('<rect xmlns="urn:foreign"/>'),
    svg('<g xmlns=""><rect/></g>'), svg('<g xmlns:foreign="urn:foreign"/>'),
    '<svg xmlns="urn:foreign"/>', svg('<rect xml:lang="en"/>'), svg('', 'style="fill:red"'),
    svg('', 'transform="scale(2)"'), svg('', 'width="100%"'), svg('', 'width="0"'),
    svg('', 'height="-1"'), svg('', 'width="Infinity"'), svg('', 'width="1e999"'),
    svg('', 'viewBox="0 0 100 100"'), svg('', 'viewBox="1 0 800 600"'), svg('', 'viewBox="0 0 800"'),
  ]) assert.throws(() => codec.decode(source), source);
});

test('SVG file store reads and atomically replaces files within its root', async t => {
  await mkdir(resolve('.tmp'), { recursive: true });
  const root = await mkdtemp(resolve('.tmp', 'svg-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new FileDocumentStore(root);
  const document = new SvgDocument(400, 300);
  document.add(ShapeFactory.create('text', 't', ['1', '2', '中文 < & >']));
  await store.write('drawing with spaces.svg', document);
  assert.deepEqual((await store.read('drawing with spaces.svg')).document.getChildren().map(snapshot), document.getChildren().map(snapshot));
  document.find('t').move(10, 20);
  await store.write(join(root, 'drawing with spaces.svg'), document);
  assert.equal((await store.read('drawing with spaces.svg')).document.find('t').getAttributes().x, '11');
  assert.deepEqual(await readdir(root), ['drawing with spaces.svg']);
});

test('SVG file store reports filesystem errors and removes failed save temporaries', async t => {
  await mkdir(resolve('.tmp'), { recursive: true });
  const root = await mkdtemp(resolve('.tmp', 'svg-errors-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new FileDocumentStore(root);
  await assert.rejects(store.read('missing.svg'), { message: 'cannot read file: missing.svg' });
  await assert.rejects(store.write('missing-parent/file.svg', new SvgDocument()), { message: 'cannot write file: missing-parent/file.svg' });
  await mkdir(join(root, 'directory.svg'));
  await writeFile(join(root, 'directory.svg', 'keep.txt'), 'unchanged');
  await assert.rejects(store.write('directory.svg', new SvgDocument()), { message: 'cannot write file: directory.svg' });
  assert.equal(await readFile(join(root, 'directory.svg', 'keep.txt'), 'utf8'), 'unchanged');
  assert.deepEqual(await readdir(root), ['directory.svg']);
  await writeFile(join(root, 'invalid.svg'), '<svg><path/></svg>');
  await assert.rejects(store.read('invalid.svg'), /unknown shape type: path/);
  await writeFile(join(root, 'unnamed.svg'), svg('<rect/>'));
  assert.deepEqual((await store.read('unnamed.svg')).warnings, ['warning: assigned id rect1 to unnamed <rect>']);
});

test('SVG file store rejects traversal, sibling prefixes, external symlinks and dangling symlinks', async t => {
  await mkdir(resolve('.tmp'), { recursive: true });
  const base = await mkdtemp(resolve('.tmp', 'svg-boundary-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'root');
  const outside = join(base, 'root-neighbor');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'original.svg'), svg('<rect id="outside"/>'));
  await symlink(outside, join(root, 'external-directory'));
  await symlink(join(outside, 'original.svg'), join(root, 'external-file.svg'));
  await symlink(join(outside, 'does-not-exist.svg'), join(root, 'dangling.svg'));
  const store = new FileDocumentStore(root);
  for (const path of ['../root-neighbor/original.svg', join(outside, 'original.svg'), 'external-directory/original.svg', 'external-file.svg', 'dangling.svg']) {
    await assert.rejects(store.read(path), /cannot read file:/);
    await assert.rejects(store.write(path, new SvgDocument()), /cannot write file:/);
  }
  await assert.rejects(store.write('external-directory/new.svg', new SvgDocument()), /cannot write file:/);
  assert.deepEqual(await readdir(outside), ['original.svg']);
  assert.match(await readFile(join(outside, 'original.svg'), 'utf8'), /outside/);
});

test('SVG file store allows in-root symlinks while preserving their targets', async t => {
  await mkdir(resolve('.tmp'), { recursive: true });
  const root = await mkdtemp(resolve('.tmp', 'svg-links-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'images'));
  await symlink('images', join(root, 'shortcut'));
  const store = new FileDocumentStore(root);
  const document = new SvgDocument(40, 30);
  await store.write('shortcut/drawing.svg', document);
  await symlink('images/drawing.svg', join(root, 'file-link.svg'));
  document.resize(50, 60);
  await store.write('file-link.svg', document);
  assert.equal((await store.read('images/drawing.svg')).document.width, 50);
  assert.equal((await store.read('file-link.svg')).document.height, 60);
  assert.deepEqual(await readdir(join(root, 'images')), ['drawing.svg']);
});
