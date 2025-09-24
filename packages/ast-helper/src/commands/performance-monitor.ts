import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";

/**
 * Command handler interface
 */
interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Performance monitor command options
 */
export interface PerformanceMonitorOptions {
  duration?: number;
  interval?: number;
  output?: string;
  config?: string;
  workspace?: string;
}

/**
 * Handler for performance monitor command
 */
export class PerformanceMonitorCommandHandler
  implements CommandHandler<PerformanceMonitorOptions> {
  private logger = createLogger();
  private isMonitoring = false;
  private monitoringData: any[] = [];

  async execute(
    options: PerformanceMonitorOptions,
    _config: Config,
  ): Promise<void> {
    const duration = options.duration || 60;
    const interval = options.interval || 1000;

    try {
      this.logger.info(
        `📈 Starting performance monitoring for ${duration} seconds...`,
      );
      this.logger.info(`Sampling interval: ${interval}ms`);

      this.isMonitoring = true;
      this.monitoringData = [];

      const startTime = Date.now();
      const endTime = startTime + duration * 1000;

      // Start monitoring loop
      const monitoringPromise = this.startMonitoringLoop(interval, endTime);

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        this.logger.info("🛑 Stopping monitoring...");
        this.isMonitoring = false;
      });

      await monitoringPromise;

      // Output results
      await this.outputResults(options);

      const actualDuration = Date.now() - startTime;
      this.logger.info(
        `✅ Monitoring completed in ${(actualDuration / 1000).toFixed(1)}s`,
      );
      this.logger.info(`📊 Collected ${this.monitoringData.length} samples`);
    } catch (error: any) {
      this.logger.error("Performance monitoring failed:", {
        error: error.message || error,
      });
      throw error;
    }
  }

  private async startMonitoringLoop(
    interval: number,
    endTime: number,
  ): Promise<void> {
    while (this.isMonitoring && Date.now() < endTime) {
      const sample = this.collectSample();
      this.monitoringData.push(sample);

      // Output live data to console
      this.outputLiveSample(sample);

      // Wait for next interval
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  private collectSample(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };
  }

  private outputLiveSample(sample: any): void {
    const time = new Date(sample.timestamp).toLocaleTimeString();
    console.log(
      `[${time}] Memory: ${sample.memory.heapUsed}MB heap, ${sample.memory.rss}MB RSS | CPU: ${(sample.cpu.user / 1000).toFixed(1)}ms user`,
    );
  }

  private async outputResults(
    options: PerformanceMonitorOptions,
  ): Promise<void> {
    if (this.monitoringData.length === 0) {
      this.logger.warn("No monitoring data collected");
      return;
    }

    // Calculate summary statistics
    const memoryValues = this.monitoringData.map((d) => d.memory.heapUsed);
    const summary = {
      samples: this.monitoringData.length,
      memory: {
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        avg: Math.round(
          memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        ),
      },
      duration:
        this.monitoringData.length > 0
          ? this.monitoringData[this.monitoringData.length - 1].timestamp -
            this.monitoringData[0].timestamp
          : 0,
    };

    // Output summary
    console.log("\n📊 Monitoring Summary");
    console.log("=====================");
    console.log(`Samples collected: ${summary.samples}`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(1)}s`);
    console.log(
      `Memory usage: ${summary.memory.min}-${summary.memory.max}MB (avg: ${summary.memory.avg}MB)`,
    );

    // Save to file if requested
    if (options.output) {
      const fs = await import("fs/promises");
      await fs.writeFile(
        options.output,
        JSON.stringify(
          {
            summary,
            samples: this.monitoringData,
          },
          null,
          2,
        ),
      );
      this.logger.info(`📁 Monitoring data saved to: ${options.output}`);
    }
  }
}
