import {
  LOG_EVENTS,
  LOG_LEVELS,
  UUID,
  type LogContext,
  type LogEnvironment,
  type LogEvent,
  type LogLevel,
  type LogService,
} from './catalog';

/** The only browser console writer. Serializes an allowlist, never the supplied error. */
export function writeConsoleRecord(
  service: LogService,
  environment: LogEnvironment,
  level: Exclude<LogLevel, 'OFF'>,
  event: LogEvent,
  context: LogContext = {},
  error?: unknown,
): void {
  if (!Object.hasOwn(LOG_EVENTS, event) || !LOG_LEVELS.includes(level)) return;
  const fields: Record<string, string | number | readonly unknown[]> = {};
  if (typeof context.request_id === 'string' && UUID.test(context.request_id))
    fields['request_id'] = context.request_id.toLowerCase();
  if (
    context.operation &&
    ['auth', 'tenants', 'establishments', 'spaces', 'demo', 'api.other'].includes(context.operation)
  )
    fields['operation'] = context.operation;
  if (
    context.method &&
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(context.method)
  )
    fields['method'] = context.method;
  for (const key of ['status', 'duration_ms', 'attempt', 'retry_delay_ms'] as const) {
    const value = context[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
      fields[key] = Math.round(value);
  }
  if (error !== undefined) fields['error_chain'] = safeErrorChain(error);
  const line = JSON.stringify({
    '@timestamp': new Date().toISOString(),
    level,
    service,
    environment,
    event,
    message: LOG_EVENTS[event],
    ...fields,
  });
  switch (level) {
    case 'DEBUG':
      console.debug(line);
      break;
    case 'INFO':
      console.info(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    case 'ERROR':
      console.error(line);
      break;
  }
}

/** Only numeric source locations survive. Arbitrary names, paths and messages never do. */
function safeErrorChain(error: unknown): readonly unknown[] {
  const chain: unknown[] = [];
  const visited = new Set<unknown>();
  let current = error;
  try {
    while (current instanceof Error && chain.length < 4 && !visited.has(current)) {
      visited.add(current);
      const type =
        current instanceof TypeError
          ? 'TypeError'
          : current instanceof SyntaxError
            ? 'SyntaxError'
            : current instanceof RangeError
              ? 'RangeError'
              : 'Error';
      const frames = (typeof current.stack === 'string' ? current.stack : '')
        .split('\n')
        .slice(1, 9)
        .flatMap((frame) => {
          const match = /:(\d{1,8}):(\d{1,8})\)?$/.exec(frame);
          const asset = /\/(main|polyfills|chunk)(-[a-z0-9]+)?\.js:\d+:\d+\)?$/i.exec(frame);
          return match
            ? [
                {
                  ...(asset ? { asset: `${asset[1]}${asset[2] ?? ''}.js` } : {}),
                  line: Number(match[1]),
                  column: Number(match[2]),
                },
              ]
            : [];
        });
      chain.push({ type, frames });
      current = current.cause;
    }
  } catch {
    // Custom Error getters are untrusted; diagnostics must not replace the original failure.
    chain.push({ type: 'UnknownError', frames: [] });
  }
  return chain.length ? chain : [{ type: 'UnknownError', frames: [] }];
}
