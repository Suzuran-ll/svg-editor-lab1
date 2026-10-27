import type { EditorApplication } from '../application/EditorApplication.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetCommand } from '../commands/SetCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { AddToCommand } from '../commands/AddToCommand.js';
import { FrontCommand } from '../commands/FrontCommand.js';
import { BackCommand } from '../commands/BackCommand.js';
import { Arguments } from './Arguments.js';
import { Tokenizer } from './Tokenizer.js';

interface Registration {
  readonly syntax: string;
  readonly invoke: (args: Arguments) => string | readonly string[] | Promise<string | readonly string[]>;
}

/** The sole command-name dispatch point. Shape-name dispatch belongs to ShapeFactory. */
export class CommandDispatcher {
  private readonly tokenizer = new Tokenizer();
  private readonly commands: ReadonlyMap<string, Registration>;

  constructor(private readonly app: EditorApplication) {
    this.commands = new Map<string, Registration>([
      ['init', { syntax: 'init [w] [h]', invoke: args => {
        args.count(0, 2);
        return this.app.init(args.length > 0 ? args.number(0) : 800, args.length > 1 ? args.number(1) : 600);
      } }],
      ['read', { syntax: 'read <file.svg>', invoke: args => { args.count(1); return this.app.read(args.value(0)); } }],
      ['save', { syntax: 'save [file.svg]', invoke: args => { args.count(0, 1); return this.app.save(args.length ? args.value(0) : undefined); } }],
      ['canvas', { syntax: 'canvas [w h]', invoke: args => {
        if (!args.length) return this.app.canvas();
        args.count(2); return this.app.resize(args.number(0), args.number(1));
      } }],
      ['create', { syntax: 'create <type> <id> [params...] [in <containerId>]', invoke: args => {
        args.count(2, Infinity);
        const suffix = args.hasContainerSuffix();
        if (suffix && args.length < 4) throw new Error('usage: create <type> <id> [params...] [in <containerId>]');
        return this.app.edit(new CreateCommand(args.value(0), args.value(1), args.values(2, suffix ? args.length - 2 : args.length), suffix ? args.value(args.length - 1) : undefined));
      } }],
      ['delete', { syntax: 'delete <id>', invoke: args => { args.count(1); return this.app.edit(new DeleteCommand(args.value(0))); } }],
      ['move', { syntax: 'move <id> <dx> <dy>', invoke: args => { args.count(3); return this.app.edit(new MoveCommand(args.value(0), args.number(1), args.number(2))); } }],
      ['scale', { syntax: 'scale <id> <factor>', invoke: args => { args.count(2); return this.app.edit(new ScaleCommand(args.value(0), args.number(1))); } }],
      ['set', { syntax: 'set <id> <attr> <value>', invoke: args => { args.count(3); return this.app.edit(new SetCommand(args.value(0), args.value(1), args.value(2))); } }],
      ['group', { syntax: 'group <newGid> <id1> <id2>...', invoke: args => { args.count(3, Infinity); return this.app.edit(new GroupCommand(args.value(0), args.values(1))); } }],
      ['ungroup', { syntax: 'ungroup <gid>', invoke: args => { args.count(1); return this.app.edit(new UngroupCommand(args.value(0))); } }],
      ['addto', { syntax: 'addto <gid> <id>', invoke: args => { args.count(2); return this.app.edit(new AddToCommand(args.value(0), args.value(1))); } }],
      ['front', { syntax: 'front <id>', invoke: args => { args.count(1); return this.app.edit(new FrontCommand(args.value(0))); } }],
      ['back', { syntax: 'back <id>', invoke: args => { args.count(1); return this.app.edit(new BackCommand(args.value(0))); } }],
      ['tree', { syntax: 'tree [id]', invoke: args => { args.count(0, 1); return this.app.tree(args.length ? args.value(0) : undefined); } }],
      ['show', { syntax: 'show <id>', invoke: args => { args.count(1); return this.app.show(args.value(0)); } }],
      ['undo', { syntax: 'undo', invoke: args => { args.count(0); return this.app.undo(); } }],
      ['redo', { syntax: 'redo', invoke: args => { args.count(0); return this.app.redo(); } }],
      ['help', { syntax: 'help', invoke: args => { args.count(0); return this.help(); } }],
    ]);
  }

  async execute(line: string): Promise<readonly string[]> {
    const tokens = this.tokenizer.tokenize(line);
    const first = tokens[0];
    if (!first) return [];
    const command = this.commands.get(first.value);
    if (!command) throw new Error(`unknown command: ${first.value}`);
    const result = await command.invoke(new Arguments(tokens.slice(1), command.syntax));
    return typeof result === 'string' ? [result] : result;
  }

  private help(): string {
    return [...this.commands.values()].map(command => command.syntax).join('\n') + '\n\n' + [
      'create rect <id> <x> <y> <w> <h> [fill]',
      'create circle <id> <cx> <cy> <r> [fill]',
      'create ellipse <id> <cx> <cy> <rx> <ry> [fill]',
      'create line <id> <x1> <y1> <x2> <y2> [stroke]',
      'create text <id> <x> <y> "content"',
      'create g <id>',
      'All create forms accept: in <containerId>',
      'Use double quotes for spaces; escape quotes as \\" and backslashes as \\\\.',
      'Use Ctrl-D (EOF) to exit. A line starting with # is a comment.',
    ].join('\n');
  }
}
