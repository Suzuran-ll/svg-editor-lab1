import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Line extends Shape {
  static readonly parameters = ['x1', 'y1', 'x2', 'y2'] as const;
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id, 'line', { x1: 'coordinate', y1: 'coordinate', x2: 'coordinate', y2: 'coordinate' }, [x1, y1, x2, y2]);
  }
  override summary(): string {
    return `${this.tag}#${this.id} (${this.number('x1')},${this.number('y1')}) -> (${this.number('x2')},${this.number('y2')})`;
  }
  override move(dx: number, dy: number): void {
    Validation.number(dx, 'dx');
    Validation.number(dy, 'dy');
    this.transform({ x1: dx, x2: dx, y1: dy, y2: dy });
  }
  override clone(): Line { return this.copyStyles(new Line(this.id, this.number('x1'), this.number('y1'), this.number('x2'), this.number('y2'))); }
  static fromArguments(id: string, args: readonly string[]): Line {
    const parsed = Validation.parametersWithPaint(args, this.parameters, 'stroke');
    const [x1, y1, x2, y2] = parsed.values;
    const shape = new Line(id, x1!, y1!, x2!, y2!);
    if (parsed.paint !== undefined) shape.setAttribute('stroke', parsed.paint);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): Line {
    const [x1, y1, x2, y2] = Validation.imported(attrs, this.parameters);
    return new Line(id, x1!, y1!, x2!, y2!).loadStyles(attrs);
  }
}
