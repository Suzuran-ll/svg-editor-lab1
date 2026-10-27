import { Shape } from './Shape.js';
import { Validation } from './Validation.js';

export class Circle extends Shape {
  static readonly parameters = ['cx', 'cy', 'r'] as const;
  constructor(id: string, cx: number, cy: number, r: number) {
    super(id, 'circle', { cx: 'coordinate', cy: 'coordinate', r: 'size' }, [cx, cy, r]);
  }
  override move(dx: number, dy: number): void {
    this.transform({ cx: Validation.number(dx, 'dx'), cy: Validation.number(dy, 'dy') });
  }
  override clone(): Circle { return this.copyStyles(new Circle(this.id, this.number('cx'), this.number('cy'), this.number('r'))); }
  static fromArguments(id: string, args: readonly string[]): Circle {
    const [cx, cy, r] = Validation.parameters(args, this.parameters);
    return new Circle(id, cx!, cy!, r!);
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): Circle {
    const [cx, cy, r] = Validation.imported(attrs, this.parameters);
    return new Circle(id, cx!, cy!, r!).loadStyles(attrs);
  }
}
