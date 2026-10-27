import { Validation } from './Validation.js';

export abstract class Shape {
  readonly #id: string;
  readonly #tag: string;
  readonly #geometry: Readonly<Record<string, 'coordinate' | 'size'>>;
  #attributes: Record<string, string>;

  protected constructor(id: string, tag: string, geometry: Readonly<Record<string, 'coordinate' | 'size'>>, values: readonly number[]) {
    this.#id = Validation.id(id);
    this.#tag = tag;
    this.#geometry = Object.freeze({ ...geometry });
    this.#attributes = {};
    Object.entries(geometry).forEach(([name, kind], index) => {
      this.#attributes[name] = String(Validation.number(values[index]!, name, kind === 'size'));
    });
  }

  get id(): string { return this.#id; }
  get tag(): string { return this.#tag; }
  getAttributes(): Readonly<Record<string, string>> { return Object.freeze({ id: this.id, ...this.#attributes }); }
  getChildren(): readonly Shape[] { return Object.freeze([]); }
  getText(): string | undefined { return undefined; }

  summary(): string {
    return `${this.tag}#${this.id}${Object.entries(this.#attributes).map(([name, value]) => ` ${name}=${value}`).join('')}`;
  }

  setAttribute(name: string, value: string): void {
    if (Object.hasOwn(this.#geometry, name)) {
      this.#attributes[name] = String(Validation.number(value, name, this.#geometry[name] === 'size'));
    } else if (name === 'stroke-width') {
      this.#attributes[name] = String(Validation.number(value, name, true));
    } else if (name === 'fill' || name === 'stroke') {
      this.#attributes[name] = Validation.xml(value);
    } else {
      throw new Error(`unknown attribute: ${name}`);
    }
  }

  /** Apply a coordinate transform only after every resulting value has passed validation. */
  protected transform(offsets: Readonly<Record<string, number>>, factor = 1): void {
    const next = { ...this.#attributes };
    for (const [name, kind] of Object.entries(this.#geometry)) {
      const result = Number(next[name]) * factor + (offsets[name] ?? 0);
      next[name] = String(Validation.number(result, name, kind === 'size'));
    }
    this.#attributes = next;
  }

  protected copyStyles<T extends Shape>(target: T): T {
    for (const name of Validation.styles) {
      const value = this.#attributes[name];
      if (value !== undefined) target.setAttribute(name, value);
    }
    return target;
  }

  /** Importers use the same setters as commands, preserving validation. */
  loadStyles(attributes: Readonly<Record<string, string>>): this {
    for (const name of Validation.styles) {
      const value = attributes[name];
      if (value !== undefined) this.setAttribute(name, value);
    }
    return this;
  }

  protected number(name: string): number { return Number(this.#attributes[name]); }
  abstract move(dx: number, dy: number): void;
  scale(factor: number): void { this.transform({}, Validation.positive(factor, 'scale factor')); }
  abstract clone(): Shape;
}
