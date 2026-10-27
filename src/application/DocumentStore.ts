import type { SvgDocument } from '../domain/SvgDocument.js';

export interface ReadResult {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

/** Port implemented by a filesystem adapter; the application never imports fs. */
export interface DocumentStore {
  read(path: string): Promise<ReadResult>;
  write(path: string, document: SvgDocument): Promise<void>;
}
