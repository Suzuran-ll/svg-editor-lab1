import type { SvgDocument } from '../domain/SvgDocument.js';
import type { CommandResult } from './CommandResult.js';

/** Command + Memento: mutate a private working copy and publish only on success. */
export abstract class EditCommand {
  private before?: SvgDocument;
  private after?: SvgDocument;
  private message = '';

  execute(current: SvgDocument): CommandResult {
    const working = current.clone();
    const message = this.apply(working);
    this.before = current.clone();
    this.after = working.clone();
    this.message = message;
    return { document: working, message };
  }

  undo(): CommandResult {
    if (!this.before) throw new Error('command has not been executed');
    return { document: this.before.clone(), message: `undone: ${this.message}` };
  }

  redo(): CommandResult {
    if (!this.after) throw new Error('command has not been executed');
    return { document: this.after.clone(), message: `redone: ${this.message}` };
  }

  protected abstract apply(document: SvgDocument): string;
}
