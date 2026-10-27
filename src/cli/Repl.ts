import { createInterface } from 'node:readline';
import type { CommandDispatcher } from './CommandDispatcher.js';

export class Repl {
  constructor(private readonly dispatcher: CommandDispatcher) {}

  async run(): Promise<void> {
    const interactive = Boolean(process.stdin.isTTY);
    const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
    terminal.setPrompt('svg> ');
    terminal.on('SIGINT', () => terminal.close());
    console.log("svg-editor 0.1 — type 'help' for commands");
    if (interactive) terminal.prompt();
    for await (const line of terminal) {
      try {
        for (const message of await this.dispatcher.execute(line)) console.log(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`error: ${message.replace(/[\r\n]+/g, ' ')}`);
      }
      if (interactive) terminal.prompt();
    }
  }
}
