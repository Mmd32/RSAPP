/**
 * Vercel serverless entrypoint.
 *
 * Vercel serves the built SPA from `dist/` as static files and routes only
 * `/api/*` here, so the Express app runs without opening a socket and without
 * serving the frontend itself. Set SERVE_CLIENT=false and DATABASE_URL in the
 * project's environment variables — a serverless filesystem is read-only and
 * not shared between invocations, so the JSON file store cannot be used here.
 */
import app from '../server/src/index.js';

export default app;
