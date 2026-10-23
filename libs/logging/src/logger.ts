import {
  ErrorHandler,
  Injectable,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  LOG_ENVIRONMENTS,
  LOG_LEVELS,
  type LogContext,
  type LogEnvironment,
  type LogEvent,
  type LogLevel,
  type LogService,
} from './catalog';
import { writeConsoleRecord } from './console-adapter';

export interface LoggingOptions {
  readonly service: LogService;
  readonly level?: LogLevel;
  readonly environment?: LogEnvironment;
}
const LOGGING_OPTIONS = new InjectionToken<LoggingOptions>('mapit.logging.options', {
  providedIn: 'root',
  factory: () => ({ service: 'mapit-browser' }),
});
const reported = new WeakSet<object>();

@Injectable({ providedIn: 'root' })
export class Logger {
  private readonly options = inject(LOGGING_OPTIONS);
  private level: LogLevel = this.options.level ?? 'INFO';
  private environment: LogEnvironment = this.options.environment ?? 'unknown';

  /** Called after runtime config loads, avoiding a Logger -> HttpClient DI cycle. */
  configure(config: { readonly logLevel?: unknown; readonly environment?: unknown }): void {
    this.level = LOG_LEVELS.includes(config.logLevel as LogLevel)
      ? (config.logLevel as LogLevel)
      : 'INFO';
    this.environment = LOG_ENVIRONMENTS.includes(config.environment as LogEnvironment)
      ? (config.environment as LogEnvironment)
      : 'unknown';
  }

  log(
    level: Exclude<LogLevel, 'OFF'>,
    event: LogEvent,
    context: LogContext = {},
    error?: unknown,
  ): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.level)) return;
    writeConsoleRecord(this.options.service, this.environment, level, event, context, error);
  }

  /** Marks even suppressed HTTP errors so ErrorHandler cannot upgrade expected 4xx to ERROR. */
  report(
    level: Exclude<LogLevel, 'OFF'>,
    event: LogEvent,
    error: unknown,
    context: LogContext = {},
  ): void {
    if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
      if (reported.has(error)) return;
      reported.add(error);
    }
    this.log(level, event, context, error);
  }
}

@Injectable()
export class LoggingErrorHandler implements ErrorHandler {
  private readonly logger = inject(Logger);
  handleError(error: unknown): void {
    this.logger.report('ERROR', 'app.error.unhandled', error);
  }
}

export function provideLogging(options: LoggingOptions) {
  return makeEnvironmentProviders([
    { provide: LOGGING_OPTIONS, useValue: options },
    { provide: ErrorHandler, useClass: LoggingErrorHandler },
  ]);
}

export function logBootstrapFailure(service: LogService, error: unknown): void {
  writeConsoleRecord(service, 'unknown', 'ERROR', 'app.bootstrap.failed', {}, error);
}
