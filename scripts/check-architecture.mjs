import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src');
const rules = {
  domain: new Set(['domain']),
  commands: new Set(['commands', 'domain']),
  application: new Set(['application', 'commands', 'domain']),
  cli: new Set(['cli', 'application', 'commands']),
  infrastructure: new Set(['infrastructure', 'application', 'domain']),
};
const external = { cli: new Set(['node:readline']), infrastructure: null };
const errors = [];
const dependencies = new Map();

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

for (const file of files(source)) {
  const label = relative(source, file);
  const layer = label.split('/')[0];
  const content = readFileSync(file, 'utf8');
  // This check intentionally examines declarations and import boundaries, not
  // arbitrary identifier substrings or harmless shape names in error messages.
  const declarations = [...content.matchAll(/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/gm)];
  if (declarations.length > 1) errors.push(`${label}: use one class per file`);
  if (declarations.length === 1 && declarations[0][1] !== basename(file, '.ts')) {
    errors.push(`${label}: class name must match the filename`);
  }
  if (basename(file) !== 'ShapeFactory.ts' && /\bcase\s+['"](?:rect|circle|ellipse|line|text)['"]\s*:/.test(content)) {
    errors.push(`${label}: keep shape-name switch dispatch inside ShapeFactory`);
  }
  const edges = [];
  const imports = [...content.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm)];
  for (const [, specifier] of imports) {
    if (specifier.startsWith('.')) {
      const target = resolve(dirname(file), specifier.replace(/\.js$/, '.ts'));
      const targetLabel = relative(source, target);
      const targetLayer = targetLabel.split('/')[0];
      edges.push(target);
      if (targetLabel.startsWith('..')) errors.push(`${label}: source imports must remain inside src`);
      else if (rules[layer] && !rules[layer].has(targetLayer)) errors.push(`${label}: forbidden dependency on ${targetLayer}`);
    } else if (rules[layer] && external[layer] !== null && !external[layer]?.has(specifier)) {
      errors.push(`${label}: forbidden external dependency ${specifier}`);
    }
  }
  dependencies.set(file, edges);
}

const visited = new Set();
const visiting = new Set();
function visit(file) {
  if (visiting.has(file)) { errors.push(`circular import: ${relative(source, file)}`); return; }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of dependencies.get(file) ?? []) visit(dependency);
  visiting.delete(file);
  visited.add(file);
}
for (const file of dependencies.keys()) visit(file);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Architecture checks passed (${dependencies.size} TypeScript files).`);
