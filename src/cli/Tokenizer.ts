import type { Token } from './Token.js';

/** Only whole lines are comments: a color such as #ffffff is an ordinary token. */
export class Tokenizer {
  tokenize(line: string): readonly Token[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let index = 0;
    while (index < line.length) {
      if (/\s/.test(line[index]!)) { index++; continue; }
      const quoted = line[index] === '"';
      let value = '';
      if (quoted) {
        index++;
        let closed = false;
        while (index < line.length) {
          const char = line[index++]!;
          if (char === '"') { closed = true; break; }
          if (char === '\\' && (line[index] === '"' || line[index] === '\\')) value += line[index++]!;
          else value += char;
        }
        if (!closed) throw new Error('unterminated double quote');
        if (index < line.length && !/\s/.test(line[index]!)) throw new Error('expected whitespace after closing quote');
      } else {
        while (index < line.length && !/\s/.test(line[index]!)) {
          if (line[index] === '"') throw new Error('double quote must start a parameter');
          value += line[index++]!;
        }
      }
      tokens.push(Object.freeze({ value, quoted }));
    }
    return tokens;
  }
}
