import type { Shape } from '../domain/Shape.js';
import type { SvgDocument } from '../domain/SvgDocument.js';

export class DocumentView {
  tree(document: SvgDocument, id?: string): string {
    const root = id === undefined ? undefined : document.find(id);
    const lines = [root ? root.summary() : `svg (${document.width}x${document.height})`];
    this.children(root ? root.getChildren() : document.getChildren(), '', lines);
    return lines.join('\n');
  }

  show(document: SvgDocument, id: string): string {
    const shape = document.find(id);
    const parent = document.getParent(id);
    const attrs = Object.entries(shape.getAttributes()).filter(([key]) => key !== 'id').map(([key, value]) => `${key}=${value}`);
    const text = shape.getText();
    if (text !== undefined) attrs.push(`text=${JSON.stringify(text)}`);
    return `${shape.tag}#${shape.id}  parent=${parent ? `g#${parent.id}` : 'svg'}\n  ${attrs.join(' ')}`;
  }

  private children(shapes: readonly Shape[], prefix: string, lines: string[]): void {
    shapes.forEach((shape, index) => {
      const last = index === shapes.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${shape.summary()}`);
      this.children(shape.getChildren(), `${prefix}${last ? '    ' : '│   '}`, lines);
    });
  }
}
