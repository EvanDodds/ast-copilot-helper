/**
 * Console log output implementation
 * Provides human-readable console output with colors and formatting
 */

import type { LogEntry, LogOutput, LogLevel } from './types.js';
import { LogLevel as LL } from './types.js';

export class ConsoleOutput implements LogOutput {
  private readonly useColors: boolean;
  private readonly includeTimestamp: boolean;

  constructor(options: { useColors?: boolean; includeTimestamp?: boolean } = {}) {
    this.useColors = options.useColors ?? true;
    this.includeTimestamp = options.includeTimestamp ?? true;
  }

  write(entry: LogEntry): void {
    const parts: string[] = [];

    // Timestamp
    if (this.includeTimestamp) {
      const timestamp = new Date(entry.timestamp).toISOString();
      parts.push(this.colorize(`[${timestamp}]`, 'gray'));
    }

    // Level indicator with color
    const levelIndicator = this.getLevelIndicator(entry.level);
    parts.push(this.colorize(levelIndicator, this.getLevelColor(entry.level)));

    // Operation context
    if (entry.operation) {
      parts.push(this.colorize(`(${entry.operation})`, 'blue'));
    }

    // Main message
    parts.push(entry.message);

    // Duration for performance logs
    if (entry.duration !== undefined) {
      const durationMs = Math.round(entry.duration);
      const color = durationMs > 1000 ? 'red' : durationMs > 500 ? 'yellow' : 'green';
      parts.push(this.colorize(`+${durationMs}ms`, color));
    }

    console.log(parts.join(' '));

    // Context on separate line if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context, null, 2)
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      console.log(this.colorize(contextStr, 'gray'));
    }

    // Error details on separate line if present
    if (entry.error) {
      console.log(this.colorize(`  Error: ${entry.error.message}`, 'red'));
      if (entry.error.code) {
        console.log(this.colorize(`  Code: ${entry.error.code}`, 'red'));
      }
      if (entry.error.stack && entry.level <= LL.DEBUG) {
        const stackLines = entry.error.stack.split('\n').slice(1, 6); // First 5 stack frames
        for (const line of stackLines) {
          console.log(this.colorize(`    ${line.trim()}`, 'gray'));
        }
      }
    }
  }

  private getLevelIndicator(level: LogLevel): string {
    switch (level) {
      case LL.ERROR: return '❌ ERROR';
      case LL.WARN:  return '⚠️  WARN ';
      case LL.INFO:  return 'ℹ️  INFO ';
      case LL.DEBUG: return '🐛 DEBUG';
      case LL.TRACE: return '🔍 TRACE';
      default: return '   UNKNOWN';
    }
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LL.ERROR: return 'red';
      case LL.WARN:  return 'yellow';
      case LL.INFO:  return 'cyan';
      case LL.DEBUG: return 'magenta';
      case LL.TRACE: return 'gray';
      default: return 'white';
    }
  }

  private colorize(text: string, color: string): string {
    if (!this.useColors) return text;

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      cyan: '\x1b[36m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      gray: '\x1b[90m',
      white: '\x1b[37m',
      reset: '\x1b[0m'
    };

    return `${colors[color] || colors.white}${text}${colors.reset}`;
  }
}
