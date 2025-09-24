/**
 * CLI argument parsing for configuration
 * Handles command-line arguments and converts them to partial configuration
 */

import type { PartialConfig, CliArgs } from "../types.js";

/**
 * Parse CLI arguments into partial configuration
 */
export function parseCliArgs(args: CliArgs): PartialConfig {
  const config: PartialConfig = {};

  // Map CLI arguments to configuration
  if (args["top-k"] !== undefined) {
    config.topK = args["top-k"];
  }

  if (args["snippet-lines"] !== undefined) {
    config.snippetLines = args["snippet-lines"];
  }

  if (args.concurrency !== undefined) {
    config.concurrency = args.concurrency;
  }

  if (args["batch-size"] !== undefined) {
    config.batchSize = args["batch-size"];
  }

  if (args["model-host"] !== undefined) {
    config.modelHost = args["model-host"];
  }

  if (args["enable-telemetry"] !== undefined) {
    config.enableTelemetry = args["enable-telemetry"];
  }

  // Parse glob patterns (comma-separated strings)
  if (args["parse-glob"] !== undefined) {
    config.parseGlob = args["parse-glob"]
      .split(",")
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 0);
  }

  if (args["watch-glob"] !== undefined) {
    config.watchGlob = args["watch-glob"]
      .split(",")
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 0);
  }

  // Parse index parameters
  if (args["ef-construction"] !== undefined || args["M"] !== undefined) {
    config.indexParams = {};

    if (args["ef-construction"] !== undefined) {
      config.indexParams.efConstruction = args["ef-construction"];
    }

    if (args["M"] !== undefined) {
      config.indexParams.M = args["M"];
    }
  }

  // Parse CLI-specific options
  if (args.outputDir !== undefined) {
    config.outputDir = args.outputDir;
  }

  if (args.verbose !== undefined) {
    config.verbose = args.verbose;
  }

  if (args.debug !== undefined) {
    config.debug = args.debug;
  }

  if (args.jsonLogs !== undefined) {
    config.jsonLogs = args.jsonLogs;
  }

  if (args.logFile !== undefined) {
    config.logFile = args.logFile;
  }

  return config;
}
