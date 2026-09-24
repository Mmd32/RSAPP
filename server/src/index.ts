/**
 * Standalone server entrypoint (`npm start`).
 *
 * Importing this module starts listening, which is why the app itself lives in
 * `app.ts`: a serverless function imports that and never opens a socket. Which
 * mode is active is decided by which file is imported, not by sniffing
 * environment variables at runtime.
 */
import { start } from './app.js';
import { logger } from './logger.js';

start().catch((e) => {
  logger.error('Server failed to start', e);
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
