/**
 * @fileoverview System diagnostic data collector
 * @module @ast-copilot-helper/ast-helper/error-reporting/diagnostics/system-collector
 */

import * as os from 'os';
import * as fs from 'fs';
import type { DiagnosticCollector, DiagnosticScope, SystemDiagnostics } from './types.js';
import type { DiagnosticData } from '../types.js';

/**
 * Collects system-level diagnostic information
 */
export class SystemDiagnosticCollector implements DiagnosticCollector {
  readonly name = 'system';
  readonly scope: DiagnosticScope = 'system';
  readonly priority = 100;
  readonly cacheTTL = 30000; // 30 seconds

  private _cpuUsageCache?: number[];
  private _cpuUsageTimestamp = 0;
  private readonly _cpuUsageCacheDuration = 1000; // 1 second

  /**
   * Collect system diagnostic data
   */
  async collect(): Promise<Partial<DiagnosticData>> {
    try {
      const [
        osInfo,
        cpuInfo,
        memoryInfo,
        diskInfo,
        networkInfo
      ] = await Promise.all([
        this.collectOSInfo(),
        this.collectCPUInfo(),
        this.collectMemoryInfo(),
        this.collectDiskInfo(),
        this.collectNetworkInfo()
      ]);

      const system: SystemDiagnostics = {
        os: osInfo,
        cpu: cpuInfo,
        memory: memoryInfo,
        disk: diskInfo,
        network: networkInfo
      };

      return { system };
    } catch (error) {
      throw new Error(`System diagnostic collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if collector can run safely
   */
  async canCollect(): Promise<boolean> {
    try {
      // Basic OS API availability check
      os.platform();
      os.arch();
      os.totalmem();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get estimated collection time
   */
  estimateCollectionTime(): number {
    return 100; // ~100ms for system info collection
  }

  /**
   * Collect OS information
   */
  private async collectOSInfo() {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      version: os.version?.() || 'unknown',
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Collect CPU information with usage monitoring
   */
  private async collectCPUInfo() {
    const cpus = os.cpus();
    const usage = await this.getCPUUsage();
    
    return {
      model: cpus[0]?.model || 'unknown',
      cores: cpus.length,
      speed: cpus[0]?.speed || 0,
      usage
    };
  }

  /**
   * Get CPU usage with caching
   */
  private async getCPUUsage(): Promise<number[]> {
    const now = Date.now();
    
    // Return cached value if still fresh
    if (this._cpuUsageCache && (now - this._cpuUsageTimestamp) < this._cpuUsageCacheDuration) {
      return this._cpuUsageCache;
    }
    
    return new Promise((resolve) => {
      const startMeasure = this.getCPUTimes();
      
      setTimeout(() => {
        const endMeasure = this.getCPUTimes();
        const usage = this.calculateCPUUsage(startMeasure, endMeasure);
        
        this._cpuUsageCache = usage;
        this._cpuUsageTimestamp = now;
        
        resolve(usage);
      }, 100); // 100ms sample
    });
  }

  /**
   * Get CPU times for all cores
   */
  private getCPUTimes() {
    return os.cpus().map(cpu => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
    }));
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCPUUsage(start: Array<{idle: number, total: number}>, end: Array<{idle: number, total: number}>): number[] {
    return start.map((startCore, index) => {
      const endCore = end[index];
      
      // Guard against missing end core data
      if (!endCore) {
return 0;
}
      
      const idleDiff = endCore.idle - startCore.idle;
      const totalDiff = endCore.total - startCore.total;
      
      if (totalDiff === 0) {
return 0;
}
      
      const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
      return Math.max(0, Math.min(100, usage));
    });
  }

  /**
   * Collect memory information
   */
  private async collectMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    const memoryInfo = {
      total,
      free,
      used,
      percentage
    };

    // Add swap information if available (Linux)
    if (os.platform() === 'linux') {
      try {
        const swapInfo = await this.getSwapInfo();
        return {
          ...memoryInfo,
          swap: swapInfo
        };
      } catch {
        // Ignore swap collection errors
      }
    }

    return memoryInfo;
  }

  /**
   * Get swap memory information (Linux only)
   */
  private async getSwapInfo(): Promise<{ total: number; free: number; used: number } | undefined> {
    try {
      const meminfo = await fs.promises.readFile('/proc/meminfo', 'utf8');
      const swapTotalMatch = meminfo.match(/SwapTotal:\s+(\d+)\s+kB/);
      const swapFreeMatch = meminfo.match(/SwapFree:\s+(\d+)\s+kB/);
      
      if (swapTotalMatch?.[1] && swapFreeMatch?.[1]) {
        const total = parseInt(swapTotalMatch[1]) * 1024;
        const free = parseInt(swapFreeMatch[1]) * 1024;
        const used = total - free;
        
        return { total, free, used };
      }
    } catch {
      // Ignore errors
    }
    
    return undefined;
  }

  /**
   * Collect disk information
   */
  private async collectDiskInfo() {
    try {
      const cwd = process.cwd();
      const stats = await this.getDiskUsage(cwd);
      
      return {
        total: stats.total,
        free: stats.free,
        used: stats.used,
        percentage: stats.percentage
      };
    } catch (error) {
      // Fallback with minimal info
      return {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0
      };
    }
  }

  /**
   * Get disk usage for a path
   */
  private async getDiskUsage(path: string): Promise<{ total: number; free: number; used: number; percentage: number }> {
    if (os.platform() === 'win32') {
      return this.getWindowsDiskUsage(path);
    } else {
      return this.getUnixDiskUsage(path);
    }
  }

  /**
   * Get Windows disk usage using wmic
   */
  private async getWindowsDiskUsage(path: string): Promise<{ total: number; free: number; used: number; percentage: number }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      const drive = path.charAt(0).toUpperCase();
      const { stdout } = await execAsync(`wmic logicaldisk where caption="${drive}:" get size,freespace /value`);
      
      const sizeMatch = stdout.match(/Size=(\d+)/);
      const freeMatch = stdout.match(/FreeSpace=(\d+)/);
      
      if (sizeMatch?.[1] && freeMatch?.[1]) {
        const total = parseInt(sizeMatch[1]);
        const free = parseInt(freeMatch[1]);
        const used = total - free;
        const percentage = (used / total) * 100;
        
        return { total, free, used, percentage };
      }
    } catch {
      // Fall through to default
    }
    
    return { total: 0, free: 0, used: 0, percentage: 0 };
  }

  /**
   * Get Unix disk usage using statvfs
   */
  private async getUnixDiskUsage(path: string): Promise<{ total: number; free: number; used: number; percentage: number }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync(`df -B1 "${path}" | tail -1`);
      const fields = stdout.trim().split(/\s+/);
      
      if (fields.length >= 6 && fields[1] && fields[2] && fields[3]) {
        const total = parseInt(fields[1]);
        const used = parseInt(fields[2]);
        const free = parseInt(fields[3]);
        const percentage = (used / total) * 100;
        
        return { total, free, used, percentage };
      }
    } catch {
      // Fall through to default
    }
    
    return { total: 0, free: 0, used: 0, percentage: 0 };
  }

  /**
   * Collect network information
   */
  private async collectNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networkInterfaces = [];
    let activeConnections = 0;
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) {
continue;
}
      
      for (const addr of addresses) {
        networkInterfaces.push({
          name,
          family: addr.family as 'IPv4' | 'IPv6',
          address: addr.address,
          internal: addr.internal,
          mac: addr.mac
        });
        
        if (!addr.internal && addr.family === 'IPv4') {
          activeConnections++;
        }
      }
    }
    
    return {
      interfaces: networkInterfaces,
      activeConnections
    };
  }
}