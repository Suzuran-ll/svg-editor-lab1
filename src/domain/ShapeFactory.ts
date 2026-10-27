import { Shape } from './Shape.js';
import { Rect } from './Rect.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Line } from './Line.js';
import { Text } from './Text.js';
import { Group } from './Group.js';

type ShapeConstructor = {
  fromArguments(id: string, args: readonly string[]): Shape;
  fromSvg(id: string, attrs: Readonly<Record<string, string>>, text?: string): Shape;
};

export class ShapeFactory {
  // Phase 1's one shape-name dispatch point; replace with a registry for plugins.
  static resolve(type: string): ShapeConstructor {
    const constructors: Readonly<Record<string, ShapeConstructor>> = {
      rect: Rect, circle: Circle, ellipse: Ellipse, line: Line, text: Text, g: Group,
    };
    if (!Object.hasOwn(constructors, type)) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return constructors[type]!;
  }

  static create(type: string, id: string, args: readonly string[]): Shape {
    return this.resolve(type).fromArguments(id, args);
  }

  static fromSvg(type: string, id: string, attrs: Readonly<Record<string, string>>, text?: string): Shape {
    if (attrs.id !== undefined && attrs.id !== id) throw new Error('imported id does not match shape id');
    return this.resolve(type).fromSvg(id, attrs, text);
  }
}
