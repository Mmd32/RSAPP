import { logger } from '../logger.js';
import { DATA_DIR, ensureDir, isWritable } from '../config.js';
import { DataStore } from './types.js';
import { JsonDataStore } from './jsonStore.js';
import { PostgresDataStore } from './postgresStore.js';

export * from './types.js';
export { JsonDataStore } from './jsonStore.js';
export { PostgresDataStore } from './postgresStore.js';

/**
 * Picks the persistence backend: PostgreSQL when DATABASE_URL is set, JSON
 * files otherwise. If the database is configured but unreachable, startup fails
 * loudly rather than silently writing to a disk that the next redeploy wipes.
 */
export async function createDataStore(): Promise<DataStore> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    const store = new PostgresDataStore(connectionString);
    try {
      await store.init();
      return store;
    } catch (e) {
      logger.error('Could not initialise PostgreSQL store', e);
      await store.close().catch(() => undefined);
      // Keep the driver's error as the cause: its code (ENOTFOUND, 28P01,
      // ETIMEDOUT...) is what actually identifies the misconfiguration.
      throw new Error(
        'DATABASE_URL is set but the database is unreachable. Fix the connection or unset DATABASE_URL to fall back to JSON files.',
        { cause: e }
      );
    }
  }

  // Without a database the JSON store is the fallback -- but only where the
  // disk can actually be written. On a read-only or ephemeral filesystem
  // (a serverless deployment with DATABASE_URL unset) it would accept every
  // write and lose it, which is far worse than refusing to start.
  ensureDir(DATA_DIR);
  if (!isWritable(DATA_DIR)) {
    const error: NodeJS.ErrnoException = new Error(
      `No database is configured and the data directory (${DATA_DIR}) is not writable, so nothing could be saved. Set DATABASE_URL to a PostgreSQL connection string.`
    );
    error.code = 'STORAGE_NOT_WRITABLE';
    logger.error('Refusing to start with unwritable storage and no database', error);
    throw error;
  }

  const store = new JsonDataStore();
  await store.init();
  return store;
}
