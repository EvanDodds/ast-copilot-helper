/**
 * Performance Testing Utilities
 * 
 * Utilities for timing, measurement, and performance testing operations.
 */

export class PerformanceTimer {
  private timers: Map<string, number> = new Map();
  
  static async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  lap(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      throw new Error(`Timer '${label}' not found`);
    }
    return performance.now() - startTime;
  }

  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      throw new Error(`Timer '${label}' not found`);
    }
    const duration = performance.now() - startTime;
    this.timers.delete(label);
    return duration;
  }

  static assertPerformance(duration: number, threshold: number, operation: string): void {
    if (duration > threshold) {
      throw new Error(
        `Performance assertion failed for ${operation}: ` +
        `${duration}ms > ${threshold}ms threshold`
      );
    }
  }
}

export class CPUMonitor {
  private startUsage: NodeJS.CpuUsage | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private samples: number[] = [];

  start(): void {
    this.startUsage = process.cpuUsage();
    this.samples = [];
    
    // Sample CPU usage every 100ms
    this.intervalId = setInterval(() => {
      if (this.startUsage) {
        const usage = process.cpuUsage(this.startUsage);
        const totalTime = usage.user + usage.system;
        const elapsedMs = Date.now();
        const cpuPercent = (totalTime / 1000 / elapsedMs) * 100;
        this.samples.push(cpuPercent);
      }
    }, 100);
  }

  async stop(): Promise<number> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.samples.length === 0) {
      return 0;
    }

    // Return average CPU usage
    return this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length;
  }
}

export class MemoryMonitor {
  private samples: NodeJS.MemoryUsage[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    this.samples = [];
    this.samples.push(process.memoryUsage());
    
    // Sample memory usage every 100ms
    this.intervalId = setInterval(() => {
      this.samples.push(process.memoryUsage());
    }, 100);
  }

  stop(): MemoryStats {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.samples.push(process.memoryUsage());

    if (this.samples.length === 0) {
      const current = process.memoryUsage();
      return {
        peak: current.heapUsed / 1024 / 1024,
        average: current.heapUsed / 1024 / 1024,
        start: current.heapUsed / 1024 / 1024,
        end: current.heapUsed / 1024 / 1024,
      };
    }

    const heapUsages = this.samples.map(s => s.heapUsed / 1024 / 1024);
    
    return {
      peak: Math.max(...heapUsages),
      average: heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length,
      start: heapUsages[0] ?? 0,
      end: heapUsages[heapUsages.length - 1] ?? 0,
    };
  }
}

export interface MemoryStats {
  peak: number;      // Peak memory usage in MB
  average: number;   // Average memory usage in MB
  start: number;     // Starting memory usage in MB
  end: number;       // Ending memory usage in MB
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

export function formatMemory(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)}MB`;
  } else {
    const gb = mb / 1024;
    return `${gb.toFixed(1)}GB`;
  }
}

export function calculateThroughput(itemCount: number, durationMs: number): number {
  return (itemCount * 1000) / durationMs; // items per second
}