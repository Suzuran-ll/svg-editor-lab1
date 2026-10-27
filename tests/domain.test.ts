import test from 'node:test';
import assert from 'node:assert/strict';
import { Shape } from '../src/domain/Shape.js';
import { ShapeFactory } from '../src/domain/ShapeFactory.js';
import { Rect } from '../src/domain/Rect.js';
import { Circle } from '../src/domain/Circle.js';
import { Ellipse } from '../src/domain/Ellipse.js';
import { Line } from '../src/domain/Line.js';
import { Text } from '../src/domain/Text.js';
import { Group } from '../src/domain/Group.js';
import { SvgDocument } from '../src/domain/SvgDocument.js';

function snapshot(document: SvgDocument): unknown {
  const shapeData = (shape: Shape): unknown => ({
    tag: shape.tag, attrs: shape.getAttributes(), text: shape.getText(), children: shape.getChildren().map(shapeData),
  });
  return { width: document.width, height: document.height, children: document.getChildren().map(shapeData) };
}

function ids(shapes: readonly Shape[]): string[] { return shapes.map(shape => shape.id); }

test('tree summaries use task-friendly inline geometry without changing SVG attributes', () => {
  const rect = new Rect('r', 1, 2, 3, 4);
  assert.equal(rect.summary(), 'rect#r x=1 y=2 w=3 h=4');
  assert.equal(rect.getAttributes().width, '3');
  assert.equal(new Line('l', 1, 2, 3, 4).summary(), 'line#l (1,2) -> (3,4)');
  assert.equal(new Text('t', 1, 2, 'hello').summary(), 'text#t (1,2) "hello"');
});

test('factory creates all six shapes and dispatches SVG through the same classes', () => {
  const cases = [
    ['rect', ['1', '2', '3', '4'], Rect], ['circle', ['1', '2', '3'], Circle],
    ['ellipse', ['1', '2', '3', '4'], Ellipse], ['line', ['1', '2', '3', '4'], Line],
    ['text', ['1', '2', '中文 text'], Text], ['g', [], Group],
  ] as const;
  for (const [type, args, Constructor] of cases) {
    const shape = ShapeFactory.create(type, type, args);
    assert.ok(shape instanceof Constructor);
    const restored = ShapeFactory.fromSvg(type, shape.id, shape.getAttributes(), shape.getText());
    assert.deepEqual(restored.getAttributes(), shape.getAttributes());
    assert.equal(restored.getText(), shape.getText());
  }
  for (const type of ['hexagon', 'constructor', '__proto__']) {
    assert.throws(() => ShapeFactory.create(type, 'x', []), new RegExp(`unknown shape type: ${type}`));
  }
});

test('move translates each geometry while scale changes coordinates and sizes about origin', () => {
  const cases: [Shape, Record<string, string>][] = [
    [new Rect('r', -1, 2, 3, 4), { id: 'r', x: '4', y: '-4', width: '6', height: '8' }],
    [new Circle('c', -1, 2, 3), { id: 'c', cx: '4', cy: '-4', r: '6' }],
    [new Ellipse('e', -1, 2, 3, 4), { id: 'e', cx: '4', cy: '-4', rx: '6', ry: '8' }],
    [new Line('l', -1, 2, 3, 4), { id: 'l', x1: '4', y1: '-4', x2: '12', y2: '0' }],
    [new Text('t', -1, 2, 'hello'), { id: 't', x: '4', y: '-4' }],
  ];
  for (const [shape, expected] of cases) {
    shape.move(3, -4);
    shape.scale(2);
    assert.deepEqual(shape.getAttributes(), expected);
  }
});

test('strict numeric parsing accepts finite decimal/exponents and rejects ambiguous values', () => {
  const rect = ShapeFactory.create('rect', 'r', ['-.5', '+1e2', '.25', '0']);
  assert.deepEqual(rect.getAttributes(), { id: 'r', x: '-0.5', y: '100', width: '0.25', height: '0' });
  for (const value of ['', ' ', '1px', '0x10', 'Infinity', 'NaN', '1e999']) {
    assert.throws(() => ShapeFactory.create('circle', 'c', ['0', value, '1']), /finite number/);
  }
  assert.throws(() => new Circle('c', 1, 2, -1), /nonnegative/);
  assert.throws(() => new Rect('r', 0, 0, -1, 1), /nonnegative/);
  assert.throws(() => new Ellipse('e', 0, 0, 1, -1), /nonnegative/);
  assert.throws(() => ShapeFactory.create('rect', 'r', ['1']), /expected 4 or 5 arguments/);
  assert.throws(() => ShapeFactory.create('g', 'g', ['1']), /expected 0 arguments/);
});

test('create supports one optional fill or stroke while rejecting blank paint and excess arguments', () => {
  const cases = [
    ['rect', ['0', '0', '10', '20'], 'fill'],
    ['circle', ['0', '0', '10'], 'fill'],
    ['ellipse', ['0', '0', '10', '20'], 'fill'],
    ['line', ['0', '0', '10', '20'], 'stroke'],
  ] as const;
  for (const [type, args, attribute] of cases) {
    const plain = ShapeFactory.create(type, 'plain', args);
    assert.equal(plain.getAttributes()[attribute], undefined);
    const colored = ShapeFactory.create(type, 'colored', [...args, '#12ab34']);
    assert.equal(colored.getAttributes()[attribute], '#12ab34');
    assert.equal(colored.clone().getAttributes()[attribute], '#12ab34');
    assert.throws(() => ShapeFactory.create(type, 'excess', [...args, 'red', 'blue']), /expected \d or \d arguments/);
    for (const empty of ['', '  ']) {
      assert.throws(() => ShapeFactory.create(type, 'empty', [...args, empty]), new RegExp(`${attribute} must be nonempty`));
    }
  }
});

test('attribute whitelist permits only each shape geometry, text content, and three styles', () => {
  const text = new Text('t', 1, 2, '');
  text.setAttribute('text', '中文 < & "quote"');
  text.setAttribute('x', '-1');
  text.setAttribute('fill', '#ffffff');
  text.setAttribute('stroke', 'none');
  text.setAttribute('stroke-width', '.5');
  assert.equal(text.getText(), '中文 < & "quote"');
  assert.equal(text.getAttributes().fill, '#ffffff');
  assert.equal(text.getAttributes()['stroke-width'], '0.5');
  for (const name of ['id', 'font-size', 'width', 'style', 'transform']) {
    assert.throws(() => text.setAttribute(name, 'x'), new RegExp(`unknown attribute: ${name}`));
  }
  assert.throws(() => text.setAttribute('stroke-width', '-1'), /nonnegative/);
  assert.throws(() => new Rect('r', 0, 0, 1, 1).setAttribute('text', 'x'), /unknown attribute: text/);
  assert.throws(() => new Group('g').setAttribute('x', '1'), /unknown attribute: x/);
});

test('IDs are nonempty, case sensitive, XML compatible and whitespace free', () => {
  for (const id of ['', 'hello world', 'a\nb', 'a\u0000b']) assert.throws(() => new Group(id));
  const document = new SvgDocument();
  document.add(new Group('x'));
  document.add(new Group('X'));
  assert.equal(document.count(), 2);
  assert.throws(() => new Text('t', 0, 0, '\u0001'), /not allowed in XML/);
  assert.throws(() => new Text('t', 0, 0, '\ud800'), /not allowed in XML/);
  assert.doesNotThrow(() => new Text('t', 0, 0, '😀\t\n\r'));
});

test('SVG factory uses zero defaults, retains only explicit styles, and rejects unsupported attributes', () => {
  const circle = ShapeFactory.fromSvg('circle', 'c', {});
  assert.deepEqual(circle.getAttributes(), { id: 'c', cx: '0', cy: '0', r: '0' });
  assert.deepEqual(ShapeFactory.fromSvg('g', 'g', {}).getAttributes(), { id: 'g' });
  assert.equal(ShapeFactory.fromSvg('text', 't', {}).getText(), '');
  assert.throws(() => ShapeFactory.fromSvg('rect', 'r', { rx: '2' }), /unknown attribute: rx/);
  assert.throws(() => ShapeFactory.fromSvg('rect', 'r', { style: 'fill:red' }), /unknown attribute: style/);
  assert.throws(() => ShapeFactory.fromSvg('rect', 'r', { id: 'other' }), /id does not match/);
  assert.throws(() => ShapeFactory.fromSvg('circle', 'c', { r: '-2' }), /nonnegative/);
});

test('public attributes and children are defensive read-only snapshots', () => {
  const rect = new Rect('r', 1, 2, 3, 4);
  const attributes = rect.getAttributes();
  assert.throws(() => { (attributes as Record<string, string>).x = '99'; }, TypeError);
  assert.equal(rect.getAttributes().x, '1');
  const group = new Group('g');
  group.attach(rect);
  assert.throws(() => (group.getChildren() as Shape[]).push(new Group('bad')), TypeError);
  const document = new SvgDocument();
  document.add(group);
  assert.throws(() => (document.getChildren() as Shape[]).pop(), TypeError);
  assert.equal(document.count(), 2);
});

test('deep clone retains subclasses, styles and text but shares no mutable state', () => {
  const outer = new Group('outer');
  const inner = new Group('inner');
  const text = new Text('t', 1, 2, 'before');
  text.setAttribute('stroke-width', '3');
  inner.attach(text);
  outer.attach(inner);
  outer.setAttribute('fill', 'blue');
  const document = new SvgDocument(120, 80);
  document.add(outer);
  const clone = document.clone();
  assert.deepEqual(snapshot(clone), snapshot(document));
  assert.ok(clone.find('t') instanceof Text);
  clone.find('t').setAttribute('text', 'after');
  clone.find('outer').move(10, 20);
  clone.resize(1, 2);
  assert.equal(document.find('t').getText(), 'before');
  assert.equal(document.find('t').getAttributes().x, '1');
  assert.equal(document.width, 120);
});

test('group transforms recursively, keeping explicit child styles and group inheritance', () => {
  const group = new Group('g');
  const inner = new Group('inner');
  const rect = new Rect('r', 1, 2, 3, 4);
  rect.setAttribute('fill', 'red');
  rect.setAttribute('stroke-width', '5');
  inner.attach(rect);
  group.attach(inner);
  group.setAttribute('fill', 'blue');
  group.move(10, -10);
  group.scale(2);
  const result = group.getChildren()[0]!.getChildren()[0]!;
  assert.deepEqual(result.getAttributes(), { id: 'r', x: '22', y: '-16', width: '6', height: '8', fill: 'red', 'stroke-width': '5' });
  assert.deepEqual(group.getAttributes(), { id: 'g', fill: 'blue' });
  assert.equal(group.getChildren()[0]!.getAttributes().fill, undefined);
});

test('overflow and invalid transforms do not partially modify shapes or groups', () => {
  const group = new Group('g');
  group.attach(new Rect('small', 1, 2, 3, 4));
  group.attach(new Circle('large', Number.MAX_VALUE, 1, 2));
  const before = group.getChildren().map(shape => shape.getAttributes());
  assert.throws(() => group.scale(2), /finite number/);
  assert.deepEqual(group.getChildren().map(shape => shape.getAttributes()), before);
  assert.throws(() => group.move(Number.MAX_VALUE, 1), /finite number/);
  assert.deepEqual(group.getChildren().map(shape => shape.getAttributes()), before);
  for (const factor of [0, -1]) assert.throws(() => group.scale(factor), /scale factor must be positive/);
  assert.throws(() => new Group('empty').move(NaN, 1), /finite number/);
  assert.throws(() => new Rect('r', 1, Number.MAX_VALUE, 1, 1).move(1, Number.MAX_VALUE), /finite number/);
});

test('document validates canvas atomically and counts all descendants', () => {
  const document = new SvgDocument();
  assert.deepEqual([document.width, document.height], [800, 600]);
  assert.throws(() => document.resize(10, -1), /canvas height must be positive/);
  assert.deepEqual([document.width, document.height], [800, 600]);
  assert.throws(() => new SvgDocument(0, 1), /canvas width must be positive/);
  document.add(new Group('outer'));
  document.add(new Group('inner'), 'outer');
  document.add(new Rect('r', 0, 0, 1, 1), 'inner');
  assert.equal(document.count(), 3);
  assert.equal(document.getParent('outer'), undefined);
  assert.equal(document.getParent('r')!.id, 'inner');
  document.remove('inner');
  assert.equal(document.count(), 1);
  assert.throws(() => document.find('r'), /no such shape: r/);
});

test('document rejects duplicate IDs anywhere, missing parents and leaf parents', () => {
  const document = new SvgDocument();
  document.add(new Group('g'));
  document.add(new Rect('r', 0, 0, 1, 1), 'g');
  const before = snapshot(document);
  assert.throws(() => document.add(new Group('r')), /id already exists: r/);
  assert.throws(() => document.add(new Group('x'), 'missing'), /no such container: missing/);
  assert.throws(() => document.add(new Group('x'), 'r'), /not a container: r/);
  const incoming = new Group('incoming');
  incoming.attach(new Group('r'));
  assert.throws(() => document.add(incoming), /id already exists: r/);
  assert.deepEqual(snapshot(document), before);
});

test('grouping siblings preserves DFS order and inserts at earliest member position', () => {
  const document = new SvgDocument();
  for (const id of ['a', 'b', 'c', 'd']) document.add(new Group(id));
  document.group('joined', ['d', 'b']);
  assert.deepEqual(ids(document.getChildren()), ['a', 'joined', 'c']);
  assert.deepEqual(ids(document.find('joined').getChildren()), ['b', 'd']);
  assert.equal(document.getParent('b')!.id, 'joined');
});

test('cross-parent group uses nearest common ancestor and earliest affected branch', () => {
  const document = new SvgDocument();
  document.add(new Group('scene'));
  for (const id of ['before', 'left', 'middle', 'right']) document.add(new Group(id), 'scene');
  document.add(new Rect('a', 0, 0, 1, 1), 'left');
  document.add(new Rect('leftover', 1, 1, 1, 1), 'left');
  document.add(new Rect('b', 2, 2, 1, 1), 'right');
  document.group('pair', ['b', 'a']);
  assert.deepEqual(ids(document.find('scene').getChildren()), ['before', 'pair', 'left', 'middle', 'right']);
  assert.deepEqual(ids(document.find('pair').getChildren()), ['a', 'b']);
  assert.deepEqual(ids(document.find('left').getChildren()), ['leftover']);
  assert.deepEqual(ids(document.find('right').getChildren()), []);
});

test('grouping across root and deep nodes chooses root and remains deterministic', () => {
  const document = new SvgDocument();
  document.add(new Group('outer'));
  document.add(new Group('inner'), 'outer');
  document.add(new Circle('c', 0, 0, 1), 'inner');
  document.add(new Rect('r', 0, 0, 1, 1));
  document.group('pair', ['r', 'c']);
  assert.deepEqual(ids(document.getChildren()), ['pair', 'outer']);
  assert.deepEqual(ids(document.find('pair').getChildren()), ['c', 'r']);
});

test('invalid group selections leave tree intact', () => {
  const document = new SvgDocument();
  document.add(new Group('g'));
  document.add(new Group('child'), 'g');
  const before = snapshot(document);
  assert.throws(() => document.group('x', ['child', 'g']), /cannot group a container into its own descendant: g/);
  assert.throws(() => document.group('x', ['child', 'child']), /duplicate group member: child/);
  assert.throws(() => document.group('x', ['child', 'missing']), /no such shape: missing/);
  assert.throws(() => document.group('g', ['child']), /id already exists: g/);
  assert.throws(() => document.group('x', []), /at least two shapes/);
  assert.throws(() => document.group('x', ['child']), /at least two shapes/);
  assert.deepEqual(snapshot(document), before);
});

test('ungroup promotes nested members at their original location and rejects top-level groups', () => {
  const document = new SvgDocument();
  document.add(new Group('scene'));
  for (const id of ['before', 'group', 'after']) document.add(new Group(id), 'scene');
  for (const id of ['a', 'b']) document.add(new Circle(id, 0, 0, 1), 'group');
  assert.throws(() => document.ungroup('scene'), /cannot ungroup top-level container: scene/);
  document.ungroup('group');
  assert.deepEqual(ids(document.find('scene').getChildren()), ['before', 'a', 'b', 'after']);
  assert.throws(() => document.find('group'), /no such shape: group/);
  assert.throws(() => document.ungroup('a'), /not a container: a/);
});

test('addTo appends to destination, handles same-parent reorder, and rejects cycles', () => {
  const document = new SvgDocument();
  document.add(new Group('outer'));
  document.add(new Group('inner'), 'outer');
  document.add(new Circle('c', 0, 0, 1), 'outer');
  document.add(new Rect('r', 0, 0, 1, 1));
  const before = snapshot(document);
  assert.throws(() => document.addTo('inner', 'outer'), /cannot group a container into its own descendant: outer/);
  assert.throws(() => document.addTo('outer', 'outer'), /cannot group a container into its own descendant: outer/);
  assert.deepEqual(snapshot(document), before);
  document.addTo('outer', 'r');
  assert.deepEqual(ids(document.find('outer').getChildren()), ['inner', 'c', 'r']);
  document.addTo('outer', 'inner');
  assert.deepEqual(ids(document.find('outer').getChildren()), ['c', 'r', 'inner']);
  document.addTo('inner', 'r');
  assert.equal(document.getParent('r')!.id, 'inner');
});

test('front/back modify only sibling drawing order', () => {
  const document = new SvgDocument();
  for (const id of ['a', 'b', 'c']) document.add(new Group(id));
  document.front('a');
  assert.deepEqual(ids(document.getChildren()), ['b', 'c', 'a']);
  document.back('c');
  assert.deepEqual(ids(document.getChildren()), ['c', 'b', 'a']);
  for (const id of ['x', 'y', 'z']) document.add(new Circle(id, 0, 0, 1), 'b');
  document.front('x');
  document.back('z');
  assert.deepEqual(ids(document.find('b').getChildren()), ['z', 'y', 'x']);
  assert.deepEqual(ids(document.getChildren()), ['c', 'b', 'a']);
});

test('group attach rejects duplicate IDs and cycles without exposing mutable arrays', () => {
  const outer = new Group('outer');
  const inner = new Group('inner');
  outer.attach(inner);
  assert.throws(() => inner.attach(outer), /cannot group a container into its own descendant: outer/);
  assert.throws(() => outer.attach(new Group('inner')), /id already exists: inner/);
  assert.throws(() => outer.attach(new Group('x'), -1), /invalid child position/);
  assert.equal(outer.detach('inner'), inner);
  assert.deepEqual(outer.getChildren(), []);
  assert.throws(() => outer.detach('inner'), /no such shape: inner/);
});
