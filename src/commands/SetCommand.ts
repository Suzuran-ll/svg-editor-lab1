import type { SvgDocument } from '../domain/SvgDocument.js';
import { EditCommand } from './EditCommand.js';

export class SetCommand extends EditCommand {
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string) { super(); }
  protected override apply(document: SvgDocument): string {
    const shape = document.find(this.id);
    shape.setAttribute(this.attribute, this.value);
    return `${shape.tag}#${shape.id} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }
}
