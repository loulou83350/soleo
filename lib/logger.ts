/**
 * Logger structuré JSON pour Soleo.
 * Chaque log inclut un requestId pour la corrélation des traces.
 * Conforme aux standards d'ingénierie (gist MTA1711).
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) =>
    log('debug', message, meta),

  /**
   * Crée un logger avec un requestId fixé pour toute la durée d'une requête.
   */
  withRequestId: (requestId: string) => ({
    info: (message: string, meta?: Record<string, unknown>) =>
      log('info', message, { requestId, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log('warn', message, { requestId, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      log('error', message, { requestId, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      log('debug', message, { requestId, ...meta }),
  }),
};
