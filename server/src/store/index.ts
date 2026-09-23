import { logger } from '../logger.js';
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
      throw new Error(
        'DATABASE_URL is set but the database is unreachable. Fix the connection or unset DATABASE_URL to fall back to JSON files.'
      );
    }
  }

  const store = new JsonDataStore();
  await store.init();
  return store;
}
