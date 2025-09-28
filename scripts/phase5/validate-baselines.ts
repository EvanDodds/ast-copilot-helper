#!/usr/bin/env tsx
/**
 * Phase 5 Performance Baseline Validation Script
 *
 * This script validates that current performance baselines exist and are valid,
 * ensuring the regression testing system has proper reference data.
 *
 * Usage:
 *   yarn baseline:validate
 *   tsx scripts/phase5/validate-baselines.ts
 *   tsx scripts/phase5/validate-baselines.ts --strict  # Fail on any warnings
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface BaselineData {
  timestamp: string;
  nodeVersion: string;
  commitHash: string;
  systemInfo: {
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
  };
  benchmarks: {
    [testName: string]: {
      averageTime: number;
      standardDeviation: number;
      memoryUsage: number;
      iterations: number;
      confidence: number;
    };
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    baselineAge: number; // hours
    benchmarkCount: number;
    nodeVersionMatch: boolean;
    platformMatch: boolean;
  };
}

function validateBaselineStructure(baseline: any): string[] {
  const errors: string[] = [];

  // Check required top-level fields
  if (!baseline.timestamp) errors.push("Missing required field: timestamp");
  if (!baseline.nodeVersion) errors.push("Missing required field: nodeVersion");
  if (!baseline.commitHash) errors.push("Missing required field: commitHash");
  if (!baseline.systemInfo) errors.push("Missing required field: systemInfo");
  if (!baseline.benchmarks) errors.push("Missing required field: benchmarks");

  // Check systemInfo structure
  if (baseline.systemInfo) {
    if (!baseline.systemInfo.platform)
      errors.push("Missing systemInfo.platform");
    if (!baseline.systemInfo.arch) errors.push("Missing systemInfo.arch");
    if (typeof baseline.systemInfo.cpus !== "number")
      errors.push("Invalid systemInfo.cpus");
    if (typeof baseline.systemInfo.totalMemory !== "number")
      errors.push("Invalid systemInfo.totalMemory");
  }

  // Check benchmarks structure
  if (baseline.benchmarks && typeof baseline.benchmarks === "object") {
    for (const [benchmarkName, benchmark] of Object.entries<any>(
      baseline.benchmarks,
    )) {
      if (typeof benchmark !== "object") {
        errors.push(`Invalid benchmark data for: ${benchmarkName}`);
        continue;
      }

      if (typeof benchmark.averageTime !== "number") {
        errors.push(`Missing averageTime for benchmark: ${benchmarkName}`);
      }
      if (typeof benchmark.standardDeviation !== "number") {
        errors.push(
          `Missing standardDeviation for benchmark: ${benchmarkName}`,
        );
      }
      if (typeof benchmark.memoryUsage !== "number") {
        errors.push(`Missing memoryUsage for benchmark: ${benchmarkName}`);
      }
      if (typeof benchmark.iterations !== "number") {
        errors.push(`Missing iterations for benchmark: ${benchmarkName}`);
      }
      if (typeof benchmark.confidence !== "number") {
        errors.push(`Missing confidence for benchmark: ${benchmarkName}`);
      }
    }
  }

  return errors;
}

function generateWarnings(baseline: BaselineData): string[] {
  const warnings: string[] = [];
  const now = new Date();
  const baselineDate = new Date(baseline.timestamp);
  const ageHours = (now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60);

  // Age warnings
  if (ageHours > 168) {
    // 1 week
    warnings.push(
      `Baseline is ${Math.round(ageHours / 24)} days old - consider updating`,
    );
  } else if (ageHours > 24) {
    // 1 day
    warnings.push(`Baseline is ${Math.round(ageHours)} hours old`);
  }

  // Node version warnings
  if (baseline.nodeVersion !== process.version) {
    warnings.push(
      `Baseline Node version (${baseline.nodeVersion}) differs from current (${process.version})`,
    );
  }

  // Platform warnings
  const os = require("os");
  if (baseline.systemInfo.platform !== os.platform()) {
    warnings.push(
      `Baseline platform (${baseline.systemInfo.platform}) differs from current (${os.platform()})`,
    );
  }

  // Benchmark count warnings
  const benchmarkCount = Object.keys(baseline.benchmarks).length;
  if (benchmarkCount < 5) {
    warnings.push(
      `Low benchmark count: ${benchmarkCount} (expected at least 5)`,
    );
  }

  // Performance data quality warnings
  for (const [name, benchmark] of Object.entries(baseline.benchmarks)) {
    if (benchmark.confidence < 0.9) {
      warnings.push(
        `Low confidence (${benchmark.confidence}) for benchmark: ${name}`,
      );
    }
    if (benchmark.standardDeviation > benchmark.averageTime * 0.5) {
      warnings.push(`High variance in benchmark: ${name}`);
    }
  }

  return warnings;
}

async function validateBaseline(): Promise<ValidationResult> {
  const baselinesDir = join(process.cwd(), "ci-artifacts", "baselines");
  const currentBaselinePath = join(baselinesDir, "current-baseline.json");

  const result: ValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    summary: {
      baselineAge: 0,
      benchmarkCount: 0,
      nodeVersionMatch: false,
      platformMatch: false,
    },
  };

  // Check if baseline file exists
  if (!existsSync(currentBaselinePath)) {
    result.errors.push(
      "No current baseline found at: ci-artifacts/baselines/current-baseline.json",
    );
    result.errors.push('Run "yarn baseline:update" to create initial baseline');
    return result;
  }

  try {
    // Load and parse baseline
    const baselineContent = readFileSync(currentBaselinePath, "utf8");
    const baseline: BaselineData = JSON.parse(baselineContent);

    // Validate structure
    const structureErrors = validateBaselineStructure(baseline);
    result.errors.push(...structureErrors);

    if (structureErrors.length === 0) {
      // Generate warnings
      result.warnings = generateWarnings(baseline);

      // Calculate summary
      const baselineDate = new Date(baseline.timestamp);
      const now = new Date();
      result.summary.baselineAge =
        (now.getTime() - baselineDate.getTime()) / (1000 * 60 * 60);
      result.summary.benchmarkCount = Object.keys(baseline.benchmarks).length;
      result.summary.nodeVersionMatch =
        baseline.nodeVersion === process.version;

      const os = require("os");
      result.summary.platformMatch =
        baseline.systemInfo.platform === os.platform();

      result.isValid = true;
    }
  } catch (error) {
    result.errors.push(`Failed to parse baseline file: ${error}`);
  }

  return result;
}

async function generateValidationReport(
  validation: ValidationResult,
): Promise<void> {
  const reportPath = join(
    process.cwd(),
    "ci-artifacts",
    "baseline-validation-report.json",
  );

  const report = {
    validationTimestamp: new Date().toISOString(),
    isValid: validation.isValid,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    errors: validation.errors,
    warnings: validation.warnings,
    summary: validation.summary,
    recommendations: [] as string[],
  };

  // Generate recommendations
  if (!validation.isValid) {
    report.recommendations.push(
      'Create or update baseline data using "yarn baseline:update"',
    );
  }

  if (validation.summary.baselineAge > 168) {
    report.recommendations.push(
      "Update baseline data - current baseline is over 1 week old",
    );
  }

  if (!validation.summary.nodeVersionMatch) {
    report.recommendations.push(
      "Consider updating baseline with current Node.js version",
    );
  }

  if (validation.summary.benchmarkCount < 5) {
    report.recommendations.push(
      "Add more benchmark coverage to improve regression detection",
    );
  }

  // Write report
  require("fs").writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  console.log("🔍 Validating Phase 5 performance baselines...");

  try {
    const validation = await validateBaseline();

    // Generate report
    await generateValidationReport(validation);

    // Display results
    if (validation.isValid) {
      console.log("✅ Baseline validation passed!");
      console.log(
        `📊 ${validation.summary.benchmarkCount} benchmarks available`,
      );
      console.log(
        `⏰ Baseline age: ${Math.round(validation.summary.baselineAge)} hours`,
      );
      console.log(
        `⚙️  Node version match: ${validation.summary.nodeVersionMatch ? "✅" : "❌"}`,
      );
      console.log(
        `🖥️  Platform match: ${validation.summary.platformMatch ? "✅" : "❌"}`,
      );
    } else {
      console.log("❌ Baseline validation failed!");
    }

    // Display errors
    if (validation.errors.length > 0) {
      console.log("\n🚨 Errors:");
      for (const error of validation.errors) {
        console.log(`  - ${error}`);
      }
    }

    // Display warnings
    if (validation.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      for (const warning of validation.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    // Check strict mode
    const isStrict = process.argv.includes("--strict");
    const shouldFail =
      !validation.isValid || (isStrict && validation.warnings.length > 0);

    if (shouldFail) {
      console.log("\n💥 Validation failed");
      process.exit(1);
    } else {
      console.log("\n🎉 Validation completed successfully");
    }
  } catch (error) {
    console.error("❌ Validation script failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as validateBaselines };
