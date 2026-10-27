import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Rect extends Shape {
  static readonly parameters = ['x', 'y', 'width', 'height'] as const;
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id, 'rect', { x: 'coordinate', y: 'coordinate', width: 'size', height: 'size' }, [x, y, width, height]);
  }
  override summary(): string { return super.summary().replace(' width=', ' w=').replace(' height=', ' h='); }
  override move(dx: number, dy: number): void {
    this.transform({ x: Validation.number(dx, 'dx'), y: Validation.number(dy, 'dy') });
  }
  override clone(): Rect { return this.copyStyles(new Rect(this.id, this.number('x'), this.number('y'), this.number('width'), this.number('height'))); }
  static fromArguments(id: string, args: readonly string[]): Rect {
    const parsed = Validation.parametersWithPaint(args, this.parameters, 'fill');
    const [x, y, width, height] = parsed.values;
    const shape = new Rect(id, x!, y!, width!, height!);
    if (parsed.paint !== undefined) shape.setAttribute('fill', parsed.paint);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): Rect {
    const [x, y, width, height] = Validation.imported(attrs, this.parameters);
    return new Rect(id, x!, y!, width!, height!).loadStyles(attrs);
  }
}
