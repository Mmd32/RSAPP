import fs from 'fs';
import path from 'path';
import { dataPath, ensureDir } from './config.js';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'AUDIT' | 'SECURITY';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
  actionId?: string;
  visitId?: string;
  details?: Record<string, any>;
  durationMs?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private logFilePath: string;
  private fileLoggingEnabled: boolean;

  constructor() {
    const logsDir = dataPath('logs');
    // A read-only filesystem is acceptable: console logging still works, and
    // most managed hosts collect stdout anyway.
    this.fileLoggingEnabled = ensureDir(logsDir);
    this.logFilePath = path.join(logsDir, 'app.log');
  }

  private writeLog(entry: StructuredLogEntry) {
    const line = JSON.stringify(entry) + '\n';
    if (this.fileLoggingEnabled) {
      try {
        fs.appendFileSync(this.logFilePath, line, 'utf-8');
      } catch (e) {
        // Stop retrying once the filesystem rejects writes.
        this.fileLoggingEnabled = false;
      }
    }

    // Also output to console in readable format
    const color =
      entry.level === 'ERROR'
        ? '\x1b[31m'
        : entry.level === 'WARN'
        ? '\x1b[33m'
        : entry.level === 'AUDIT'
        ? '\x1b[36m'
        : entry.level === 'SECURITY'
        ? '\x1b[35m'
        : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(
      `${color}[${entry.level}]${reset} [${entry.timestamp}] ${entry.event} ${
        entry.details ? JSON.stringify(entry.details) : ''
      }`
    );
  }

  info(event: string, details?: Record<string, any>, meta?: Partial<StructuredLogEntry>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event,
      details,
      ...meta,
    });
  }

  warn(event: string, details?: Record<string, any>, meta?: Partial<StructuredLogEntry>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      event,
      details,
      ...meta,
    });
  }

  error(event: string, err: any, details?: Record<string, any>, meta?: Partial<StructuredLogEntry>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      event,
      error: {
        message: err?.message || String(err),
        stack: err?.stack,
      },
      details,
      ...meta,
    });
  }

  audit(
    event: string,
    actionId: string,
    fromStatus: string,
    toStatus: string,
    meta?: Partial<StructuredLogEntry>
  ) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      event,
      actionId,
      details: { fromStatus, toStatus },
      ...meta,
    });
  }

  security(event: string, details?: Record<string, any>, meta?: Partial<StructuredLogEntry>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      details,
      ...meta,
    });
  }
}

export const logger = new Logger();
