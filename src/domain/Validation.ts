export class Validation {
  static readonly styles = ['fill', 'stroke', 'stroke-width'] as const;

  static id(value: string): string {
    if (value.length === 0 || /\s/u.test(value)) throw new Error('id must be nonempty and contain no whitespace');
    this.xml(value);
    return value;
  }

  static number(value: string | number, name: string, nonnegative = false): number {
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
      throw new Error(`${name} must be a finite number`);
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
    if (nonnegative && parsed < 0) throw new Error(`${name} must be nonnegative`);
    return Object.is(parsed, -0) ? 0 : parsed;
  }

  static positive(value: string | number, name: string): number {
    const parsed = this.number(value, name);
    if (parsed <= 0) throw new Error(`${name} must be positive`);
    return parsed;
  }

  static parameters(args: readonly string[], names: readonly string[]): number[] {
    if (args.length !== names.length) throw new Error(`expected ${names.length} arguments: ${names.join(' ')}`);
    return args.map((value, index) => this.number(value, names[index]!));
  }

  static parametersWithPaint(args: readonly string[], names: readonly string[], paint: 'fill' | 'stroke'): { values: readonly number[]; paint: string | undefined } {
    if (args.length !== names.length && args.length !== names.length + 1) {
      throw new Error(`expected ${names.length} or ${names.length + 1} arguments: ${names.join(' ')} [${paint}]`);
    }
    const values = this.parameters(args.slice(0, names.length), names);
    const color = args[names.length];
    if (color !== undefined && color.trim().length === 0) throw new Error(`${paint} must be nonempty`);
    return { values, paint: color };
  }

  static imported(attrs: Readonly<Record<string, string>>, names: readonly string[]): number[] {
    const allowed = new Set(['id', ...names, ...this.styles]);
    for (const key of Object.keys(attrs)) if (!allowed.has(key)) throw new Error(`unknown attribute: ${key}`);
    return names.map(name => this.number(attrs[name] ?? '0', name));
  }

  static xml(value: string): string {
    // XML 1.0 permits tab, LF, CR, and the listed Unicode scalar ranges.
    for (const character of value) {
      const code = character.codePointAt(0)!;
      if (!(code === 0x9 || code === 0xa || code === 0xd ||
        (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff))) throw new Error('value contains a character not allowed in XML');
    }
    return value;
  }
}
