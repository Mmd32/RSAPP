/**
 * Copies the JSON data stores into PostgreSQL.
 *
 *   DATABASE_URL=postgres://... npm run db:import
 *
 * Idempotent — every row is an upsert keyed by id, so re-running it is safe and
 * simply refreshes the database from the files. Reads from DATA_DIR.
 */
import fs from 'fs';
import path from 'path';
import { dataPath } from '../config.js';
import { PostgresDataStore } from '../store/postgresStore.js';
import { CorrectiveAction, ActionAuditLog } from '../types/actions.js';

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = dataPath(fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`  ${fileName}: not found, skipping`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (e) {
    console.error(`  ${fileName}: could not be parsed — ${(e as Error).message}`);
    return fallback;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Export it first, e.g.');
    console.error('  DATABASE_URL="postgres://user:pass@host/db" npm run db:import');
    process.exit(1);
  }

  const store = new PostgresDataStore(connectionString);
  await store.init();

  const organizations = readJson<Record<string, any>>('organizations.json', {});
  const stores = readJson<any[]>('stores.json', []);
  const visits = readJson<Record<string, any>>('visits.json', {});
  const actions = readJson<Record<string, CorrectiveAction>>('actions.json', {});
  const auditLogs = readJson<ActionAuditLog[]>('action_audit_logs.json', []);

  // Organizations first: everything else references a tenant.
  for (const organization of Object.values(organizations)) {
    await store.saveOrganization(organization);
  }
  console.log(`organizations: ${Object.keys(organizations).length}`);

  for (const entry of stores) {
    await store.saveStore(entry);
  }
  console.log(`stores: ${stores.length}`);

  for (const visit of Object.values(visits)) {
    await store.saveVisit(visit);
  }
  console.log(`visits: ${Object.keys(visits).length}`);

  for (const action of Object.values(actions)) {
    await store.saveAction(action);
  }
  console.log(`corrective actions: ${Object.keys(actions).length}`);

  for (const log of auditLogs) {
    await store.appendAuditLog(log);
  }
  console.log(`audit logs: ${auditLogs.length}`);

  console.log(`\nImport complete. Start the server with the same DATABASE_URL to use it.`);
  await store.close();
}

main().catch((e) => {
  console.error('Import failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
