import type { SvgDocument } from '../domain/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class AddToCommand extends EditCommand {
  constructor(private readonly containerId: string, private readonly id: string) { super(); }
  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    document.addTo(this.containerId, this.id);
    return `${shape.tag}#${shape.id} moved into g#${this.containerId}`;
  }
}
