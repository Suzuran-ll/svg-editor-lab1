import { fileURLToPath } from 'node:url';
import { EditorApplication } from './application/EditorApplication.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Repl } from './cli/Repl.js';
import { FileDocumentStore } from './infrastructure/FileDocumentStore.js';

// The compiled entrypoint is dist/src/main.js. IO stays inside this project even
// when the user launches the CLI from a different working directory.
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const store = new FileDocumentStore(projectRoot);
const application = new EditorApplication(store);
await new Repl(new CommandDispatcher(application)).run();
