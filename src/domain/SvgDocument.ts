import { Group } from './Group.js';
import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

type Location = { shape: Shape; parent: Group | undefined; index: number; path: readonly Group[] };

export class SvgDocument {
  #width: number;
  #height: number;
  #children: Shape[] = [];

  constructor(width = 800, height = 600) {
    this.#width = Validation.positive(width, 'canvas width');
    this.#height = Validation.positive(height, 'canvas height');
  }

  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  getChildren(): readonly Shape[] { return Object.freeze([...this.#children]); }

  resize(width: number, height: number): void {
    const nextWidth = Validation.positive(width, 'canvas width');
    const nextHeight = Validation.positive(height, 'canvas height');
    this.#width = nextWidth;
    this.#height = nextHeight;
  }

  #locations(): Location[] {
    const result: Location[] = [];
    const visit = (children: readonly Shape[], parent: Group | undefined, path: readonly Group[]): void => {
      children.forEach((shape, index) => {
        result.push({ shape, parent, index, path });
        if (shape instanceof Group) visit(shape.getChildren(), shape, [...path, shape]);
      });
    };
    visit(this.#children, undefined, []);
    return result;
  }

  #location(id: string): Location {
    const location = this.#locations().find(candidate => candidate.shape.id === id);
    if (!location) throw new Error(`no such shape: ${id}`);
    return location;
  }

  #container(id: string): Group {
    const shape = this.#locations().find(candidate => candidate.shape.id === id)?.shape;
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!(shape instanceof Group)) throw new Error(`not a container: ${id}`);
    return shape;
  }

  find(id: string): Shape { return this.#location(id).shape; }
  getParent(id: string): Group | undefined { return this.#location(id).parent; }
  count(): number { return this.#locations().length; }

  #insert(shape: Shape, parent: Group | undefined, index?: number): void {
    if (parent) parent.attach(shape, index);
    else this.#children.splice(index ?? this.#children.length, 0, shape);
  }

  #detach(location: Location): Shape {
    if (location.parent) return location.parent.detach(location.shape.id);
    // Earlier removals may change the stored index, so identify the node again.
    const index = this.#children.findIndex(child => child.id === location.shape.id);
    return this.#children.splice(index, 1)[0]!;
  }

  add(shape: Shape, containerId?: string): void {
    const parent = containerId === undefined ? undefined : this.#container(containerId);
    const occupied = new Set(this.#locations().map(location => location.shape.id));
    const validate = (node: Shape): void => {
      if (occupied.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      occupied.add(node.id);
      node.getChildren().forEach(validate);
    };
    validate(shape);
    this.#insert(shape, parent);
  }

  remove(id: string): Shape { return this.#detach(this.#location(id)); }

  group(newId: string, ids: readonly string[]): void {
    Validation.id(newId);
    const locations = this.#locations();
    if (locations.some(location => location.shape.id === newId)) throw new Error(`id already exists: ${newId}`);
    if (ids.length < 2) throw new Error('group requires at least two shapes');
    const requested = new Set<string>();
    for (const id of ids) {
      if (requested.has(id)) throw new Error(`duplicate group member: ${id}`);
      requested.add(id);
      this.#location(id);
    }
    // Traversal order, not argument order, determines the new group's children.
    const members = locations.filter(location => requested.has(location.shape.id));
    for (const member of members) {
      const ancestor = member.path.find(group => requested.has(group.id));
      if (ancestor) throw new Error(`cannot group a container into its own descendant: ${ancestor.id}`);
    }

    const commonPath = [...members[0]!.path];
    for (const member of members.slice(1)) {
      let shared = 0;
      while (shared < commonPath.length && commonPath[shared] === member.path[shared]) shared++;
      commonPath.length = shared;
    }
    const parent = commonPath.at(-1);
    const siblings = parent?.getChildren() ?? this.#children;
    const branchIds = members.map(member => member.path[commonPath.length]?.id ?? member.shape.id);
    const insertionIndex = Math.min(...branchIds.map(id => siblings.findIndex(shape => shape.id === id)));

    const result = new Group(newId);
    for (const member of members) result.attach(this.#detach(member));
    this.#insert(result, parent, insertionIndex);
  }

  ungroup(id: string): void {
    const location = this.#location(id);
    if (!(location.shape instanceof Group)) throw new Error(`not a container: ${id}`);
    if (!location.parent) throw new Error(`cannot ungroup top-level container: ${id}`);
    const children = [...location.shape.getChildren()];
    this.#detach(location);
    children.forEach((child, offset) => {
      location.shape instanceof Group && location.shape.detach(child.id);
      location.parent!.attach(child, location.index + offset);
    });
  }

  addTo(containerId: string, id: string): void {
    const parent = this.#container(containerId);
    const location = this.#location(id);
    if (location.shape === parent || this.#location(parent.id).path.includes(location.shape as Group)) {
      throw new Error(`cannot group a container into its own descendant: ${id}`);
    }
    this.#detach(location);
    parent.attach(location.shape);
  }

  front(id: string): void {
    const location = this.#location(id);
    this.#detach(location);
    this.#insert(location.shape, location.parent);
  }

  back(id: string): void {
    const location = this.#location(id);
    this.#detach(location);
    this.#insert(location.shape, location.parent, 0);
  }

  clone(): SvgDocument {
    const document = new SvgDocument(this.width, this.height);
    this.#children.forEach(child => document.add(child.clone()));
    return document;
  }
}
