import { ShapeFactory } from '../domain/ShapeFactory.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class CreateCommand extends EditCommand {
  constructor(private readonly type: string, private readonly id: string, private readonly args: readonly string[], private readonly containerId?: string) { super(); }
  protected override apply(document: SvgDocument): string {
    const shape = ShapeFactory.create(this.type, this.id, this.args);
    document.add(shape, this.containerId);
    return `${shape.tag}#${shape.id} created${this.containerId ? ` in g#${this.containerId}` : ''}`;
  }
}
