#!/usr/bin/env node
/**
 * Resets the JSON data stores to a clean slate.
 *
 *   npm run data:reset          # clears visits, actions and audit logs
 *   npm run data:reset -- --all # also clears the store directory
 *
 * The store directory is kept by default because it holds the curated branch
 * list the Start-Visit wizard offers. The catalog is never touched.
 * Honours DATA_DIR, so it can also clean a mounted volume.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(projectRoot, process.env.DATA_DIR || 'data');
const clearStores = process.argv.includes('--all');

const targets = [
  ['visits.json', {}],
  ['actions.json', {}],
  ['action_audit_logs.json', []],
  ['organizations.json', {
    org_retail_holding: {
      id: 'org_retail_holding',
      name: 'هلدینگ ریتیل سلوشنز',
      code: 'RS_HOLDING',
      brands: ['ZARA', 'LC Waikiki', 'کوروش مال', 'مانگو'],
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  }],
];

if (clearStores) {
  targets.push(['stores.json', []]);
}

fs.mkdirSync(dataDir, { recursive: true });

for (const [file, empty] of targets) {
  const filePath = path.join(dataDir, file);
  fs.writeFileSync(filePath, JSON.stringify(empty, null, 2) + '\n', 'utf-8');
  console.log(`reset ${path.relative(projectRoot, filePath)}`);
}

console.log(`\nDone. Restart the server so it reloads from disk.`);
if (!clearStores) {
  console.log('The store directory was kept. Pass --all to clear it too.');
}
