/**
 * JSON log output implementation
 * Provides structured JSON output for programmatic consumption
 */

import { appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { LogEntry, LogOutput } from './types.js';

export class JsonOutput implements LogOutput {
  private readonly filePath?: string;
  private readonly pretty: boolean;
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(options: {
    filePath?: string;
    pretty?: boolean;
    maxBufferSize?: number;
    autoFlushMs?: number;
  } = {}) {
    this.filePath = options.filePath;
    this.pretty = options.pretty ?? false;
    this.maxBufferSize = options.maxBufferSize ?? 100;

    // Auto-flush timer
    if (options.autoFlushMs) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(console.error);
      }, options.autoFlushMs);
    }
  }

  write(entry: LogEntry): void {
    if (this.filePath) {
      // Buffer for file output
      this.buffer.push(entry);
      if (this.buffer.length >= this.maxBufferSize) {
        this.flush().catch(console.error);
      }
    } else {
      // Direct console output as JSON
      const json = this.formatEntry(entry);
      console.log(json);
    }
  }

  async flush(): Promise<void> {
    if (!this.filePath || this.buffer.length === 0) {
      return;
    }

    try {
      // Ensure directory exists
      await mkdir(dirname(this.filePath), { recursive: true });

      // Format all buffered entries
      const lines = this.buffer.map(entry => this.formatEntry(entry));
      const content = lines.join('\n') + '\n';

      // Append to file
      await appendFile(this.filePath, content, 'utf-8');

      // Clear buffer
      this.buffer = [];
    } catch (error) {
      console.error('Failed to flush JSON log output:', error);
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  private formatEntry(entry: LogEntry): string {
    if (this.pretty) {
      return JSON.stringify(entry, null, 2);
    } else {
      return JSON.stringify(entry);
    }
  }
}
