import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Ellipse extends Shape {
  static readonly parameters = ['cx', 'cy', 'rx', 'ry'] as const;
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id, 'ellipse', { cx: 'coordinate', cy: 'coordinate', rx: 'size', ry: 'size' }, [cx, cy, rx, ry]);
  }
  override move(dx: number, dy: number): void {
    this.transform({ cx: Validation.number(dx, 'dx'), cy: Validation.number(dy, 'dy') });
  }
  override clone(): Ellipse { return this.copyStyles(new Ellipse(this.id, this.number('cx'), this.number('cy'), this.number('rx'), this.number('ry'))); }
  static fromArguments(id: string, args: readonly string[]): Ellipse {
    const parsed = Validation.parametersWithPaint(args, this.parameters, 'fill');
    const [cx, cy, rx, ry] = parsed.values;
    const shape = new Ellipse(id, cx!, cy!, rx!, ry!);
    if (parsed.paint !== undefined) shape.setAttribute('fill', parsed.paint);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): Ellipse {
    const [cx, cy, rx, ry] = Validation.imported(attrs, this.parameters);
    return new Ellipse(id, cx!, cy!, rx!, ry!).loadStyles(attrs);
  }
}
