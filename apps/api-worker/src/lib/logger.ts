/**
 * Unified structured logger for Cloudflare Workers.
 * Outputs JSON to console + ships error/warn to Elasticsearch.
 *
 * Merges the former logger.ts (module-scoped, ES shipping) with
 * observability.ts (rich context fields, startTimer).
 *
 * ES index: {ELASTICSEARCH_INDEX_PREFIX}-{YYYY.MM.DD}
 * See #47.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

/** Rich context fields that match the ES index template mapping. */
export interface LogContext {
  userId?: string;
  siteId?: string;
  action?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  service: string;
  timestamp: string;
  userId?: string;
  siteId?: string;
  action?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: { name: string; message: string; stack?: string };
  metadata?: Record<string, unknown>;
}

const SERVICE_NAME = "safewallet";
const DEFAULT_ELASTICSEARCH_INDEX_PREFIX = "safewallet-logs";

function buildEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext,
): LogEntry {
  const {
    userId,
    siteId,
    action,
    endpoint,
    method,
    statusCode,
    duration,
    error: errorObj,
    metadata,
    ...rest
  } = context ?? {};

  const entry: LogEntry = {
    level,
    module,
    message,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  };
  if (userId !== undefined) entry.userId = userId;
  if (siteId !== undefined) entry.siteId = siteId;
  if (action !== undefined) entry.action = action;
  if (endpoint !== undefined) entry.endpoint = endpoint;
  if (method !== undefined) entry.method = method;
  if (statusCode !== undefined) entry.statusCode = statusCode;
  if (duration !== undefined) entry.duration = duration;
  if (errorObj !== undefined) entry.error = errorObj;
  const extra = Object.keys(rest).length > 0 ? rest : undefined;
  if (metadata !== undefined || extra !== undefined) {
    entry.metadata = { ...metadata, ...extra };
  }
  return entry;
}

function emit(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    default:
      console.info(json);
      break;
  }
}

function shipToElasticsearch(
  entry: LogEntry,
  elasticsearchUrl: string,
  indexPrefix: string,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  return fetch(`${elasticsearchUrl}/${indexPrefix}-${date}/_doc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...entry,
      msg: entry.message,
      "@timestamp": entry.timestamp,
    }),
  }).then(
    () => undefined,
    () => undefined,
  );
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(
    message: string,
    errOrContext?: Error | unknown | LogContext,
    context?: LogContext,
  ): void;
  debug(message: string, context?: LogContext): void;
}

export interface LoggerOptions {
  elasticsearchUrl?: string;
  elasticsearchIndexPrefix?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function createLogger(module: string, options?: LoggerOptions): Logger {
  const makeLog =
    (level: LogLevel) => (message: string, context?: LogContext) => {
      const entry = buildEntry(level, module, message, context);
      emit(entry);

      if (
        options?.elasticsearchUrl &&
        (level === "error" || level === "warn")
      ) {
        const p = shipToElasticsearch(
          entry,
          options.elasticsearchUrl,
          options.elasticsearchIndexPrefix ??
            DEFAULT_ELASTICSEARCH_INDEX_PREFIX,
        );
        if (options.waitUntil) {
          options.waitUntil(p);
        }
      }
    };

  const infoFn = makeLog("info");
  const warnFn = makeLog("warn");
  const debugFn = makeLog("debug");

  /**
   * error() supports two call signatures:
   *   error(msg, context?)        — same as info/warn
   *   error(msg, err, context?)   — Error (or thrown value) as second arg
   */
  const errorFn = (
    message: string,
    errOrContext?: Error | unknown | LogContext,
    context?: LogContext,
  ): void => {
    let resolved: LogContext | undefined;

    if (errOrContext instanceof Error) {
      resolved = {
        ...context,
        error: {
          name: errOrContext.name,
          message: errOrContext.message,
          stack: errOrContext.stack,
        },
      };
    } else if (
      errOrContext !== null &&
      errOrContext !== undefined &&
      typeof errOrContext === "object" &&
      !isErrorLike(errOrContext)
    ) {
      resolved = errOrContext as LogContext;
    } else if (errOrContext !== null && errOrContext !== undefined) {
      resolved = {
        ...context,
        error: {
          name: "UnknownError",
          message: String(errOrContext),
        },
      };
    } else {
      resolved = context;
    }

    const entry = buildEntry("error", module, message, resolved);
    emit(entry);

    if (options?.elasticsearchUrl) {
      const p = shipToElasticsearch(
        entry,
        options.elasticsearchUrl,
        options.elasticsearchIndexPrefix ?? DEFAULT_ELASTICSEARCH_INDEX_PREFIX,
      );
      if (options.waitUntil) {
        options.waitUntil(p);
      }
    }
  };

  return {
    info: infoFn,
    warn: warnFn,
    error: errorFn,
    debug: debugFn,
  };
}

/** Detect Error-like objects that should be treated as thrown values. */
function isErrorLike(obj: object): boolean {
  const rec = obj as Record<string, unknown>;
  return (
    typeof rec["name"] === "string" &&
    typeof rec["message"] === "string" &&
    typeof rec["stack"] === "string"
  );
}

/**
 * Track performance with structured logging.
 *
 * @example
 *   const timer = startTimer(logger);
 *   // ... operation ...
 *   timer.end("database_query", { userId, siteId });
 */
export function startTimer(logger?: Logger): {
  end: (action: string, context?: LogContext) => void;
} {
  const start = Date.now();

  return {
    end(action: string, context: LogContext = {}) {
      const duration = Date.now() - start;
      const logFn = logger ?? _defaultLogger;
      logFn.info(`${action} completed`, {
        action,
        duration,
        ...context,
      });
    },
  };
}

const _defaultLogger = createLogger("app");

export const log: Logger = _defaultLogger;
