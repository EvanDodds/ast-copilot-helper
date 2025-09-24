import { PerformanceBenchmarkRunner } from "../performance/benchmark-runner.js";
import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Command handler interface
 */
interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Performance report command options
 */
export interface PerformanceReportOptions {
  outputDir?: string;
  format?: string;
  includeCharts?: boolean;
  compare?: string;
  config?: string;
  workspace?: string;
}

/**
 * Handler for performance report command
 */
export class PerformanceReportCommandHandler
  implements CommandHandler<PerformanceReportOptions> {
  private logger = createLogger();

  async execute(
    options: PerformanceReportOptions,
    _config: Config,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info("📊 Generating performance report...");

      // Initialize benchmark runner and generate report
      const runner = new PerformanceBenchmarkRunner();
      const report = await runner.generatePerformanceReport();

      // Set up output directory
      const outputDir = options.outputDir || "./performance-report";
      const format = options.format || "html";

      await fs.mkdir(outputDir, { recursive: true });

      // Generate report in requested format
      if (format === "html") {
        const htmlContent = this.generateHtmlReport(report, options);
        const htmlPath = path.join(outputDir, "index.html");
        await fs.writeFile(htmlPath, htmlContent);
        this.logger.info(`📁 HTML report saved to: ${htmlPath}`);
      } else if (format === "json") {
        const jsonPath = path.join(outputDir, "performance-report.json");
        await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
        this.logger.info(`📁 JSON report saved to: ${jsonPath}`);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`✅ Report generation completed in ${duration}ms`);
    } catch (error: any) {
      this.logger.error("Performance report generation failed:", {
        error: error.message || error,
      });
      throw error;
    }
  }

  private generateHtmlReport(
    report: any,
    options: PerformanceReportOptions,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AST Helper - Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .section { padding: 20px; border-bottom: 1px solid #e9ecef; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        .table th { background: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Report</h1>
            <p>Generated: ${new Date().toISOString()}</p>
            <p>Status: <span class="${report.validation?.passed ? "status-pass" : "status-fail"}">${report.validation?.passed ? "PASSED" : "FAILED"}</span></p>
        </div>
        
        <div class="section">
            <h2>🖥️ System Information</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${report.systemInfo?.platform || "Unknown"}</div>
                    <div class="metric-label">Platform</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.systemInfo?.cpuCount || 0}</div>
                    <div class="metric-label">CPU Cores</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${((report.systemInfo?.totalMemory || 0) / 1024).toFixed(1)}GB</div>
                    <div class="metric-label">Total Memory</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.systemInfo?.nodeVersion || "Unknown"}</div>
                    <div class="metric-label">Node.js Version</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 Performance Summary</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${report.memoryProfile?.peakUsage?.toFixed(1) || "N/A"} MB</div>
                    <div class="metric-label">Peak Memory Usage</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.concurrencyResults?.maxSustainableConcurrency || "N/A"}</div>
                    <div class="metric-label">Max Concurrency</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.validation?.summary?.passRate?.toFixed(1) || 0}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.validation?.summary?.totalTests || 0}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
            </div>
        </div>
        
        ${options.includeCharts ? '<div class="section"><h2>📈 Performance Charts</h2><p>Chart functionality would be implemented here</p></div>' : ""}
        
        <div class="section">
            <h2>💡 Recommendations</h2>
            ${
              report.recommendations?.length > 0
                ? "<ul>" +
                  report.recommendations
                    .map((rec: string) => `<li>${rec}</li>`)
                    .join("") +
                  "</ul>"
                : "<p>No specific recommendations at this time.</p>"
            }
        </div>
    </div>
</body>
</html>`;
  }
}
