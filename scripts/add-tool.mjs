#!/usr/bin/env node
// Add or update a single-file tool:
//   node scripts/add-tool.mjs <file.html> <slug> "<Name>" "<description>" [live|building|idea]
// Copies the file to tools/<slug>/index.html and updates tools/registry.json.
// A new tool starts at 1.0.0. Updating an existing one bumps the patch version
// (pass --minor or --major to bump more). Commit and push; Vercel deploys it.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const bump = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch';
const [file, slug, name, description, status] = args.filter(a => !a.startsWith('--'));

if (!file || !slug) {
  console.error('Usage: node scripts/add-tool.mjs <file.html> <slug> "<Name>" "<description>" [live|building|idea] [--minor|--major]');
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Slug must be lowercase letters, numbers and dashes: ${slug}`);
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}
if (status && !['live', 'building', 'idea'].includes(status)) {
  console.error(`Status must be live, building or idea: ${status}`);
  process.exit(1);
}

const html = readFileSync(file, 'utf8');
if (!/<html[\s>]/i.test(html)) {
  console.error('That file does not look like an HTML page.');
  process.exit(1);
}

const dest = join(root, 'tools', slug);
mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, 'index.html'), html);

const registryPath = join(root, 'tools', 'registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const existing = registry.tools.find(t => t.id === slug);

function next(version) {
  const [ma, mi, pa] = (version || '1.0.0').split('.').map(Number);
  if (bump === 'major') return `${ma + 1}.0.0`;
  if (bump === 'minor') return `${ma}.${mi + 1}.0`;
  return `${ma}.${mi}.${pa + 1}`;
}

if (existing) {
  if (existing.kind !== 'hosted') {
    console.error(`"${slug}" is already listed as an external app. Pick another slug.`);
    process.exit(1);
  }
  existing.version = next(existing.version);
  existing.updated = today;
  if (name) existing.name = name;
  if (description) existing.description = description;
  if (status) existing.status = status;
} else {
  const entry = {
    id: slug,
    name: name || slug,
    description: description || '',
    kind: 'hosted',
    path: `${slug}/`,
    version: '1.0.0',
    status: status || 'live',
    tags: [],
    added: today,
    updated: today
  };
  const firstExternal = registry.tools.findIndex(t => t.kind !== 'hosted');
  registry.tools.splice(firstExternal < 0 ? registry.tools.length : firstExternal, 0, entry);
}
registry.updated = today;
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

const tool = registry.tools.find(t => t.id === slug);
console.log(`${existing ? 'Updated' : 'Added'} ${tool.name} v${tool.version} → tools/${slug}/`);
