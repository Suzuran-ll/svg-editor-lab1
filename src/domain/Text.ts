import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Text extends Shape {
  static readonly parameters = ['x', 'y'] as const;
  #text: string;
  constructor(id: string, x: number, y: number, text: string) {
    super(id, 'text', { x: 'coordinate', y: 'coordinate' }, [x, y]);
    this.#text = Validation.xml(text);
  }
  override getText(): string { return this.#text; }
  override summary(): string { return `${this.tag}#${this.id} (${this.number('x')},${this.number('y')}) ${JSON.stringify(this.#text)}`; }
  override setAttribute(name: string, value: string): void {
    if (name === 'text') this.#text = Validation.xml(value);
    else super.setAttribute(name, value);
  }
  override move(dx: number, dy: number): void {
    this.transform({ x: Validation.number(dx, 'dx'), y: Validation.number(dy, 'dy') });
  }
  override clone(): Text { return this.copyStyles(new Text(this.id, this.number('x'), this.number('y'), this.#text)); }
  static fromArguments(id: string, args: readonly string[]): Text {
    if (args.length !== 3) throw new Error('expected 3 arguments: x y text');
    const [x, y] = Validation.parameters(args.slice(0, 2), this.parameters);
    return new Text(id, x!, y!, args[2]!);
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>, text = ''): Text {
    const [x, y] = Validation.imported(attrs, this.parameters);
    return new Text(id, x!, y!, text).loadStyles(attrs);
  }
}
