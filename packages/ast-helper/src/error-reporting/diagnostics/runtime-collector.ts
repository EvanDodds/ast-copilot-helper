/**
 * Runtime diagnostic collector for Node.js environment information
 */

import * as os from "os";
import { builtinModules } from "module";
import type {
  DiagnosticCollector,
  DiagnosticScope,
  RuntimeDiagnostics,
} from "./types.js";
import type { DiagnosticData } from "../types.js";

/**
 * Collects runtime diagnostic data including Node.js environment,
 * process information, memory usage, and dependencies
 */
export class RuntimeDiagnosticCollector implements DiagnosticCollector {
  readonly name = "runtime";
  readonly scope: DiagnosticScope = "runtime";
  readonly priority = 2;
  readonly cacheTTL = 30000; // 30 seconds

  /**
   * Check if this collector can run in the current environment
   */
  async canCollect(): Promise<boolean> {
    return (
      typeof process !== "undefined" && process.versions?.node !== undefined
    );
  }

  /**
   * Get estimated collection time in milliseconds
   */
  estimateCollectionTime(): number {
    return 100; // Estimated 100ms for runtime data collection
  }

  /**
   * Collect runtime diagnostic data
   */
  async collect(): Promise<Partial<DiagnosticData>> {
    if (!(await this.canCollect())) {
      return {};
    }

    try {
      const runtimeData: RuntimeDiagnostics = {
        node: await this.collectNodeInfo(),
        heap: this.collectHeapInfo(),
        gc: this.collectGCInfo(),
        eventLoop: await this.collectEventLoopInfo(),
        modules: this.collectModuleInfo(),
      };

      return {
        runtime: runtimeData,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Collect Node.js process information
   */
  private async collectNodeInfo() {
    return {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime(),
      execPath: process.execPath,
      execArgv: process.execArgv,
      argv: process.argv.slice(2), // Remove node path and script path
      env: this.getFilteredEnvironment(),
    };
  }

  /**
   * Get filtered environment variables for privacy
   */
  private getFilteredEnvironment(): Record<string, string> {
    const env = process.env;
    const filtered: Record<string, string> = {};

    // Only include safe environment variables
    const safeVars = [
      "NODE_ENV",
      "NODE_OPTIONS",
      "SHELL",
      "TERM",
      "HOME",
      "USER",
      "LANG",
      "TZ",
    ];

    for (const key of safeVars) {
      if (env[key]) {
        filtered[key] = env[key]!;
      }
    }

    return filtered;
  }

  /**
   * Collect heap memory information
   */
  private collectHeapInfo() {
    const memUsage = process.memoryUsage();

    // Estimate heap limit (V8 default is ~1.4GB on 64-bit, ~700MB on 32-bit)
    const estimatedLimit = process.arch === "x64" ? 1400000000 : 700000000;

    return {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      limit: estimatedLimit,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
    };
  }

  /**
   * Collect garbage collection information
   */
  private collectGCInfo() {
    // Note: Real GC stats would require v8 module or process monitoring
    // This provides basic placeholder data
    return {
      collections: 0,
      duration: 0,
      frequency: 0,
      lastCollection: undefined,
    };
  }

  /**
   * Collect event loop information
   */
  private async collectEventLoopInfo() {
    const start = process.hrtime.bigint();

    // Measure event loop lag by scheduling immediate
    await new Promise((resolve) => setImmediate(resolve));

    const end = process.hrtime.bigint();
    const lag = Number(end - start) / 1000000; // Convert to milliseconds

    return {
      lag,
      utilization: 0, // Would require more complex monitoring
    };
  }

  /**
   * Collect loaded modules information
   */
  private collectModuleInfo() {
    const moduleIds = Object.keys(require.cache);

    // Get built-in modules list
    let nativeModules: string[] = [];
    try {
      // Try to access built-in modules
      nativeModules = [...builtinModules];
    } catch {
      // Fallback to empty array if not available
      nativeModules = [];
    }

    return {
      loaded: moduleIds.map((id) => this.sanitizeModulePath(id)),
      cache: moduleIds.length,
      nativeModules: nativeModules,
    };
  }

  /**
   * Sanitize module paths for privacy
   */
  private sanitizeModulePath(path: string): string {
    // Remove user-specific paths and keep relative structure
    const cwd = process.cwd();
    if (path.startsWith(cwd)) {
      return path.replace(cwd, "<project>");
    }

    // Replace home directory
    const home = os.homedir();
    if (path.startsWith(home)) {
      return path.replace(home, "<home>");
    }

    // Keep node_modules paths relative
    const nodeModulesIndex = path.indexOf("node_modules");
    if (nodeModulesIndex !== -1) {
      return path.substring(nodeModulesIndex);
    }

    return "<system>";
  }
}
