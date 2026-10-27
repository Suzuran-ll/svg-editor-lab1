import type { SvgDocument } from '../domain/SvgDocument.js';
import type { EditCommand } from './EditCommand.js';
import type { CommandResult } from './CommandResult.js';

export class CommandHistory {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];
  private locked = false;

  execute(command: EditCommand, document: SvgDocument): CommandResult {
    const result = command.execute(document);
    this.undoStack.push(command);
    this.redoStack = [];
    this.locked = false;
    return result;
  }

  undo(): CommandResult {
    this.assertUnlocked();
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    const result = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return result;
  }

  redo(): CommandResult {
    this.assertUnlocked();
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    const result = command.redo();
    this.redoStack.pop();
    this.undoStack.push(command);
    return result;
  }

  resetAfterIo(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.locked = true;
  }

  private assertUnlocked(): void {
    if (this.locked) throw new Error('undo not allowed after io command');
  }
}
