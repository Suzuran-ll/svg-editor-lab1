import { createInterface } from 'node:readline';

const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
console.log("svg-editor 0.1 — type 'help' for commands");
terminal.setPrompt('svg> ');
if (process.stdin.isTTY) terminal.prompt();
for await (const line of terminal) {
  if (line.trim() === 'help') console.log('SVG editor project initialized. Editing commands will follow.');
  else if (line.trim() && !line.trim().startsWith('#')) console.log('error: unknown command');
  if (process.stdin.isTTY) terminal.prompt();
}
