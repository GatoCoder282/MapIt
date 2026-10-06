export const LOG_EVENTS = {
  'app.bootstrap.failed': 'Application bootstrap failed',
  'app.error.unhandled': 'Unhandled application error',
  'config.fallback': 'Runtime configuration unavailable; defaults active',
  'http.request.completed': 'API request completed',
  'http.request.failed': 'API request failed',
  'flags.degraded': 'Feature flag refresh unavailable',
  'flags.recovered': 'Feature flag refresh recovered',
  'realtime.connected': 'Realtime connected',
  'realtime.failed': 'Realtime transport failed',
  'realtime.retry': 'Realtime reconnect scheduled',
  'realtime.message.invalid': 'Invalid realtime message',
} as const;

export type LogEvent = keyof typeof LOG_EVENTS;
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'OFF';
export type LogService = 'mapit-console' | 'mapit-public-web' | 'mapit-browser';
export type LogEnvironment = 'development' | 'test' | 'staging' | 'production' | 'unknown';
export type LogOperation = 'auth' | 'tenants' | 'establishments' | 'spaces' | 'demo' | 'api.other';

/** An allowlist, never a generic object: no payloads, URLs, identities or credentials. */
export interface LogContext {
  readonly request_id?: string;
  readonly operation?: LogOperation;
  readonly method?: string;
  readonly status?: number;
  readonly duration_ms?: number;
  readonly attempt?: number;
  readonly retry_delay_ms?: number;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LOG_LEVELS: readonly LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'];
export const LOG_ENVIRONMENTS: readonly LogEnvironment[] = [
  'development',
  'test',
  'staging',
  'production',
  'unknown',
];
