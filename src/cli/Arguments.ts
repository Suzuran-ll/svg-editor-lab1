import type { Token } from './Token.js';

export class Arguments {
  constructor(private readonly tokens: readonly Token[], private readonly syntax: string) {}

  count(min: number, max = min): void {
    if (this.tokens.length < min || this.tokens.length > max) throw new Error(`usage: ${this.syntax}`);
  }

  get length(): number { return this.tokens.length; }

  value(index: number): string {
    const token = this.tokens[index];
    if (!token) throw new Error(`usage: ${this.syntax}`);
    return token.value;
  }

  number(index: number): number {
    const value = this.value(index);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
      throw new Error(`invalid number: ${value}`);
    }
    return Number(value);
  }

  values(start = 0, end = this.length): readonly string[] {
    return this.tokens.slice(start, end).map(token => token.value);
  }

  hasContainerSuffix(): boolean {
    const marker = this.tokens.at(-2);
    return marker?.value === 'in' && !marker.quoted;
  }
}
