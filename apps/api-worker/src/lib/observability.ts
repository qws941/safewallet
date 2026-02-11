/**
 * Structured logging for Cloudflare Workers Logs
 * 
 * Workers Logs automatically indexes JSON object fields for querying.
 * Use object logging instead of string concatenation for better searchability.
 * 
 * Example queries in Workers Logs:
 *   - Filter by level: `json.level = "error"`
 *   - Find specific user: `json.userId = "123e4567"`
 *   - Search actions: `json.action = "post_created"`
 *   - Filter by site: `json.siteId = "abc-def"`
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  level: LogLevel;
  message: string;
  timestamp: string;
  userId?: string;
  siteId?: string;
  action?: string;
  endpoint?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Structured logger that outputs JSON objects for Workers Logs indexing
 * ALWAYS use this instead of raw console.log for production code
 */
export const log = {
  debug(message: string, context: Partial<Omit<LogContext, "level" | "message" | "timestamp">> = {}): void {
    console.log({
      level: "debug",
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  },

  info(message: string, context: Partial<Omit<LogContext, "level" | "message" | "timestamp">> = {}): void {
    console.log({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  },

  warn(message: string, context: Partial<Omit<LogContext, "level" | "message" | "timestamp">> = {}): void {
    console.log({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
  },

  error(message: string, err: Error | unknown, context: Partial<Omit<LogContext, "level" | "message" | "timestamp" | "error">> = {}): void {
    const error = err instanceof Error
      ? {
          name: err.name,
          message: err.message,
          stack: err.stack,
        }
      : {
          name: "UnknownError",
          message: String(err),
        };

    console.log({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      error,
      ...context,
    });
  },
};

/**
 * Track performance metrics with structured logging
 * Use for measuring operation duration
 * 
 * Example:
 *   const timer = startTimer();
 *   // ... operation ...
 *   timer.end("database_query", { userId, siteId });
 */
export function startTimer(): {
  end: (action: string, context?: Partial<Omit<LogContext, "level" | "message" | "timestamp" | "action" | "duration">>) => void;
} {
  const start = Date.now();
  
  return {
    end(action: string, context = {}) {
      const duration = Date.now() - start;
      log.info(`${action} completed`, {
        action,
        duration,
        ...context,
      });
    },
  };
}
