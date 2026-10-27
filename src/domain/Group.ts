import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Group extends Shape {
  #children: Shape[] = [];
  constructor(id: string) { super(id, 'g', {}, []); }
  override getChildren(): readonly Shape[] { return Object.freeze([...this.#children]); }

  attach(shape: Shape, index = this.#children.length): void {
    if (!Number.isInteger(index) || index < 0 || index > this.#children.length) throw new Error('invalid child position');
    const occupied = new Set<string>();
    const visit = (node: Shape, ids: Set<string>): void => {
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
      node.getChildren().forEach(child => visit(child, ids));
    };
    visit(this, occupied);
    const incoming = new Set<string>();
    visit(shape, incoming);
    if (incoming.has(this.id)) throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
    for (const id of incoming) if (occupied.has(id)) throw new Error(`id already exists: ${id}`);
    this.#children.splice(index, 0, shape);
  }

  detach(id: string): Shape {
    const index = this.#children.findIndex(child => child.id === id);
    if (index < 0) throw new Error(`no such shape: ${id}`);
    return this.#children.splice(index, 1)[0]!;
  }

  override move(dx: number, dy: number): void {
    Validation.number(dx, 'dx');
    Validation.number(dy, 'dy');
    const transformed = this.#children.map(child => child.clone());
    transformed.forEach(child => child.move(dx, dy));
    this.#children = transformed;
  }

  override scale(factor: number): void {
    Validation.positive(factor, 'scale factor');
    const transformed = this.#children.map(child => child.clone());
    transformed.forEach(child => child.scale(factor));
    this.#children = transformed;
  }

  override clone(): Group {
    const group = this.copyStyles(new Group(this.id));
    this.#children.forEach(child => group.attach(child.clone()));
    return group;
  }
  static fromArguments(id: string, args: readonly string[]): Group {
    Validation.parameters(args, []);
    return new Group(id);
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): Group {
    Validation.imported(attrs, []);
    return new Group(id).loadStyles(attrs);
  }
}
