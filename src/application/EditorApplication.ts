import { SvgDocument } from '../domain/SvgDocument.js';
import { CommandHistory } from '../commands/CommandHistory.js';
import type { EditCommand } from '../commands/EditCommand.js';
import type { DocumentStore } from './DocumentStore.js';
import { DocumentView } from './DocumentView.js';

export class EditorApplication {
  private document?: SvgDocument;
  private path?: string;
  private readonly history = new CommandHistory();
  private readonly view = new DocumentView();

  constructor(private readonly store: DocumentStore) {}

  init(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.document = document;
    this.path = undefined;
    this.history.resetAfterIo();
    return `canvas ${width}x${height} created`;
  }

  async read(path: string): Promise<readonly string[]> {
    const result = await this.store.read(path);
    this.document = result.document;
    this.path = path;
    this.history.resetAfterIo();
    return [...result.warnings, `read ${path} (${result.document.count()} elements)`];
  }

  async save(path?: string): Promise<string> {
    const document = this.requireDocument();
    const destination = path ?? this.path;
    if (!destination) throw new Error('no file path. use save <file.svg>');
    await this.store.write(destination, document);
    this.path = destination;
    this.history.resetAfterIo();
    return `saved to ${destination} (${document.count()} elements)`;
  }

  canvas(): string {
    const document = this.requireDocument();
    return `canvas ${document.width}x${document.height}`;
  }

  resize(width: number, height: number): string {
    const working = this.requireDocument().clone();
    working.resize(width, height);
    this.document = working;
    this.history.resetAfterIo();
    return this.canvas();
  }

  edit(command: EditCommand): string {
    const result = this.history.execute(command, this.requireDocument());
    this.document = result.document;
    return result.message;
  }

  undo(): string {
    this.requireDocument();
    const result = this.history.undo();
    this.document = result.document;
    return result.message;
  }

  redo(): string {
    this.requireDocument();
    const result = this.history.redo();
    this.document = result.document;
    return result.message;
  }

  tree(id?: string): string { return this.view.tree(this.requireDocument(), id); }
  show(id: string): string { return this.view.show(this.requireDocument(), id); }

  private requireDocument(): SvgDocument {
    if (!this.document) throw new Error("no document. use 'init' or 'read' first");
    return this.document;
  }
}
