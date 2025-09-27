/**
 * Simple logger for MCP server components
 */
interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta?: Record<string, unknown>;
}

class Logger {
  private logs: LogEntry[] = [];

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  private log(
    level: LogEntry["level"],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };

    this.logs.push(entry);

    // Output to console for debugging
    const logMethod =
      level === "error"
        ? console.error // eslint-disable-line no-console
        : level === "warn"
          ? console.warn // eslint-disable-line no-console
          : console.log; // eslint-disable-line no-console

    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    logMethod(
      `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`,
    );
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
