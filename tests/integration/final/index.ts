/**
 * @fileoverview Main entry point for integration test suite
 */

import { IntegrationTestOrchestrator } from "./orchestrator.js";
import { promises as fs } from "fs";
import * as path from "path";

async function main() {
  console.log(
    "🚀 Starting Final Integration Test Suite for Production Readiness...\n",
  );

  const workspaceRoot = process.cwd();
  const orchestrator = new IntegrationTestOrchestrator(workspaceRoot);

  try {
    // Initialize orchestrator
    await orchestrator.initialize();

    // Run comprehensive integration tests
    const report = await orchestrator.runAllIntegrationTests();

    // Display results
    console.log("\n📊 FINAL RESULTS:");
    console.log(
      `Overall Ready for Production: ${report.overallReady ? "✅ YES" : "❌ NO"}`,
    );
    console.log(`Readiness Score: ${report.readinessScore.toFixed(1)}%`);

    if (report.criticalIssues.length > 0) {
      console.log("\n🚨 CRITICAL ISSUES TO ADDRESS:");
      for (const issue of report.criticalIssues) {
        console.log(`  • [${issue.severity.toUpperCase()}] ${issue.message}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      for (const recommendation of report.recommendations) {
        const priority =
          recommendation.priority === "high"
            ? "🔴"
            : recommendation.priority === "medium"
              ? "🟡"
              : "🟢";
        console.log(`  ${priority} ${recommendation.message}`);
      }
    }

    // Exit with appropriate code
    const exitCode = report.overallReady ? 0 : 1;
    console.log(
      `\n${report.overallReady ? "✅" : "❌"} Integration test suite completed with exit code ${exitCode}`,
    );
    process.exit(exitCode);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Integration test suite failed:", errorMessage);

    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error in main:", error);
    process.exit(1);
  });
}

export { main as runIntegrationTestSuite };
export { IntegrationTestOrchestrator } from "./orchestrator.js";
export { FinalTestRunner } from "./test-runner.js";
export * from "./test-config.js";
