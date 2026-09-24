/**
 * Vercel serverless entrypoint.
 *
 * Imports the Express app only — never `server/src/index.ts`, which would start
 * a listening server. Vercel serves the built SPA from `dist/` as static files
 * and routes `/api/*` here, so set SERVE_CLIENT=false and DATABASE_URL in the
 * project's environment variables: a serverless filesystem is read-only and not
 * shared between invocations, so the JSON file store cannot be used here.
 */
import app from '../server/src/app.js';

export default app;
