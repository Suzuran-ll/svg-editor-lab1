import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { DocumentStore, ReadResult } from '../application/DocumentStore.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';

/** Files are confined to this root, including when paths contain symbolic links. */
export class FileDocumentStore implements DocumentStore {
  readonly #root: string;
  readonly #codec = new SvgCodec();

  constructor(rootDirectory: string) { this.#root = resolve(rootDirectory); }

  async read(path: string): Promise<ReadResult> {
    let source: string;
    try {
      const candidate = this.#candidate(path);
      const root = await realpath(this.#root);
      const actual = await realpath(candidate);
      this.#assertContained(root, actual);
      source = await readFile(actual, 'utf8');
    } catch (cause) {
      throw new Error(`cannot read file: ${path}`, { cause });
    }
    // Keep semantic/parse errors distinct from filesystem errors.
    return this.#codec.decode(source);
  }

  async write(path: string, document: SvgDocument): Promise<void> {
    const source = this.#codec.encode(document);
    let temporary: string | undefined;
    try {
      const candidate = this.#candidate(path);
      const root = await realpath(this.#root);
      const actual = await this.#resolveDestination(candidate, root);
      // Parent directories must already exist. Resolve again immediately before writing.
      const parent = await realpath(dirname(actual));
      this.#assertContained(root, parent);
      temporary = join(parent, `.${basename(actual)}.${randomUUID()}.tmp`);
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(source, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, actual);
      temporary = undefined;
    } catch (cause) {
      throw new Error(`cannot write file: ${path}`, { cause });
    } finally {
      if (temporary !== undefined) await unlink(temporary).catch(() => undefined);
    }
  }

  #candidate(path: string): string {
    if (!path.trim() || path.includes('\0')) throw new Error('invalid path');
    const candidate = resolve(this.#root, path);
    this.#assertContained(this.#root, candidate);
    return candidate;
  }

  #assertContained(root: string, candidate: string): void {
    const distance = relative(root, candidate);
    if (distance === '..' || distance.startsWith(`..${sep}`) || isAbsolute(distance)) {
      throw new Error('path must stay inside the project directory');
    }
  }

  async #resolveDestination(candidate: string, root: string): Promise<string> {
    let ancestor = candidate;
    const missing: string[] = [];
    for (;;) {
      try {
        const actual = await realpath(ancestor);
        this.#assertContained(root, actual);
        return join(actual, ...missing);
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        // A dangling symlink is not a missing directory/file we may create through.
        const info = await lstat(ancestor).catch((failure: unknown) => {
          if (failure instanceof Error && 'code' in failure && failure.code === 'ENOENT') return undefined;
          throw failure;
        });
        if (info?.isSymbolicLink()) throw new Error('cannot save through a dangling symbolic link');
        const parent = dirname(ancestor);
        if (parent === ancestor) throw error;
        missing.unshift(basename(ancestor));
        ancestor = parent;
      }
    }
  }
}
