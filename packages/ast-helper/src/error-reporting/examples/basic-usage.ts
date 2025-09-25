/**
 * Basic Error Reporting Example
 *
 * This example demonstrates the most common use cases for the error reporting system:
 * - Basic error reporting
 * - Getting error suggestions
 * - Handling different error types and severities
 */

import { ComprehensiveErrorReportingManager } from "../manager";
import type { ErrorReportingConfig } from "../types";

async function basicUsageExample() {
  console.log("🚀 Starting Basic Error Reporting Example\n");

  // Initialize the error reporting system
  const errorManager = new ComprehensiveErrorReportingManager();

  // Configure the system
  const config: ErrorReportingConfig = {
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    enableAutomaticReporting: false,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 1024 * 1024, // 1MB
    maxHistoryEntries: 1000,
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 5000,
      includeEnvironmentVars: false,
      includeProcessInfo: true,
    },
  };

  await errorManager.initialize(config);

  try {
    // Example 1: Generate and report a parse error
    console.log("📝 Example 1: Reporting a parse error");
    const parseError = new Error('Unexpected token "}" at line 42');
    parseError.name = "SyntaxError";

    const parseErrorReport = await errorManager.generateErrorReport(
      parseError,
      {
        fileName: "src/components/UserProfile.tsx",
        line: 42,
        column: 15,
        operation: "ast-parsing",
      },
    );

    const parseErrorResult = await errorManager.reportError(parseErrorReport);
    console.log(`✅ Parse error reported with ID: ${parseErrorResult.errorId}`);
    console.log(
      `💡 Generated ${parseErrorResult.suggestions?.length || 0} suggestions for parse error\n`,
    );

    // Example 2: Report a memory warning
    console.log("📝 Example 2: Reporting a memory warning");
    const memoryError = new Error("Memory usage exceeds 80% threshold");
    const memoryReport = await errorManager.generateErrorReport(memoryError, {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      threshold: 80,
      operation: "memory-monitoring",
    });

    const memoryResult = await errorManager.reportError(memoryReport);
    console.log(
      `⚠️ Memory warning reported with ID: ${memoryResult.errorId}\n`,
    );

    // Example 3: Report a configuration error
    console.log("📝 Example 3: Reporting a configuration error");
    const configError = new Error("Missing required configuration: API_KEY");
    const configReport = await errorManager.generateErrorReport(configError, {
      configFile: "config/production.json",
      missingKeys: ["API_KEY", "DATABASE_URL"],
      operation: "initialization",
    });

    const configResult = await errorManager.reportError(configReport);
    console.log(
      `🔧 Configuration error reported with ID: ${configResult.errorId}\n`,
    );

    // Example 4: Get system diagnostics
    console.log("� Example 4: Getting system diagnostics");
    const diagnostics = await errorManager.exportDiagnostics("json");
    const diagnosticsData = JSON.parse(diagnostics);
    console.log(`📈 System diagnostics collected`);
    console.log(
      `📊 Environment: ${diagnosticsData.environment?.platform} ${diagnosticsData.environment?.arch}`,
    );
    console.log(
      `⚡ Node version: ${diagnosticsData.environment?.nodeVersion}\n`,
    );

    // Example 5: Get error history
    console.log("� Example 5: Getting error history");
    const errorHistory = await errorManager.getErrorHistory();
    console.log(`📈 Total errors in history: ${errorHistory.length}`);

    if (errorHistory.length > 0) {
      const recentError = errorHistory[errorHistory.length - 1];
      if (recentError && recentError.error) {
        console.log(`📊 Most recent error: ${recentError.error.message}`);
        console.log(
          `⏰ Timestamp: ${recentError.error.timestamp.toISOString()}\n`,
        );
      }
    }

    console.log("✅ Basic usage example completed successfully!");
  } catch (error) {
    console.error("❌ Error in basic usage example:", error);
  } finally {
    // Clean up resources
    await errorManager.cleanup();
    console.log("🧹 Cleanup completed");
  }
}

async function errorTypeExamples() {
  console.log("\n🔍 Demonstrating Different Error Types\n");

  const errorManager = new ComprehensiveErrorReportingManager();
  await errorManager.initialize({
    enabled: true,
    enableCrashReporting: true,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    enableAutomaticReporting: false,
    privacyMode: false,
    userReportingEnabled: true,
    maxReportSize: 1024 * 1024,
    maxHistoryEntries: 100,
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 5000,
      includeEnvironmentVars: false,
      includeProcessInfo: true,
    },
  });

  const errorExamples = [
    {
      name: "Syntax Error",
      error: new Error('Unexpected token: expected ";" but found "}"'),
      context: { file: "main.ts", line: 25, operation: "parsing" },
    },
    {
      name: "Network Error",
      error: new Error("Failed to connect to remote server"),
      context: {
        endpoint: "/api/v1/data",
        timeout: 5000,
        operation: "api-request",
      },
    },
    {
      name: "Performance Warning",
      error: new Error("Function execution time exceeds recommended threshold"),
      context: {
        functionName: "processLargeDataset",
        executionTime: 2500,
        operation: "function-execution",
      },
    },
  ];

  for (const { name, error, context } of errorExamples) {
    console.log(`📝 Generating and reporting ${name}:`);

    // Set error name for better categorization
    error.name = name.replace(" ", "");

    const errorReport = await errorManager.generateErrorReport(error, context);
    const result = await errorManager.reportError(errorReport);

    console.log(`   ID: ${result.errorId}`);
    console.log(`   Suggestions: ${result.suggestions?.length || 0} generated`);
    console.log(`   Category: ${errorReport.category}\n`);
  }

  await errorManager.cleanup();
}

// Run the examples
if (require.main === module) {
  (async () => {
    await basicUsageExample();
    await errorTypeExamples();
  })().catch(console.error);
}

export { basicUsageExample, errorTypeExamples };
