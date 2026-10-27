import type { SvgDocument } from '../domain/SvgDocument.js';

export interface CommandResult {
  readonly document: SvgDocument;
  readonly message: string;
}
