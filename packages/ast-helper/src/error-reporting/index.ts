/**
 * Error Reporting System
 * Comprehensive error reporting and diagnostics for AST Copilot Helper
 */

import { ComprehensiveErrorReportingManager } from "./manager.js";
import type {
  ErrorReportingConfig,
  ReportResult,
  ErrorHistoryEntry,
} from "./types.js";

// Export main interfaces and types
export type {
  ErrorReportingManager,
  ErrorReportingConfig,
  ErrorReport,
  CrashReport,
  DiagnosticContext,
  DiagnosticData,
  SuggestionResult,
  ErrorHistoryEntry,
  ReportResult,
  ErrorContext,
  EnvironmentInfo,
  SystemDiagnostics,
  RuntimeDiagnostics,
  CodebaseDiagnostics,
  ConfigurationDiagnostics,
  PerformanceDiagnostics,
  DependencyDiagnostics,
  ResolutionInfo,
  UserFeedback,
} from "./types.js";

// Export main implementation
export { ComprehensiveErrorReportingManager } from "./manager.js";

// Create and export default instance
export const errorReporter = new ComprehensiveErrorReportingManager();

/**
 * Initialize the error reporting system with default configuration
 */
export async function initializeErrorReporting(
  config?: Partial<ErrorReportingConfig>,
): Promise<void> {
  const defaultConfig: ErrorReportingConfig = {
    enabled: true,
    enableCrashReporting: true,
    enableAutomaticReporting: false,
    collectSystemInfo: true,
    collectCodebaseInfo: true,
    maxReportSize: 1024 * 1024, // 1MB
    maxHistoryEntries: 100,
    privacyMode: false,
    userReportingEnabled: true,
    diagnosticDataCollection: {
      system: true,
      runtime: true,
      codebase: true,
      configuration: true,
      performance: true,
      dependencies: true,
      maxCollectionTimeMs: 10000,
      includeEnvironmentVars: true,
      includeProcessInfo: true,
    },
  };

  const mergedConfig = { ...defaultConfig, ...config };
  await errorReporter.initialize(mergedConfig);
}

/**
 * Report an error to the system
 */
export async function reportError(
  error: Error,
  context?: any,
): Promise<ReportResult> {
  const errorReport = await errorReporter.generateErrorReport(error, context);
  return await errorReporter.reportError(errorReport);
}

/**
 * Set the current operation for context tracking
 */
export function setCurrentOperation(operation: string): void {
  errorReporter.setCurrentOperation(operation);
}

/**
 * Get error history
 */
export async function getErrorHistory(): Promise<ErrorHistoryEntry[]> {
  return await errorReporter.getErrorHistory();
}

/**
 * Clear error history
 */
export async function clearErrorHistory(): Promise<void> {
  return await errorReporter.clearErrorHistory();
}

/**
 * Export diagnostic data
 */
export async function exportDiagnostics(
  format: "json" | "text" = "json",
): Promise<string> {
  return await errorReporter.exportDiagnostics(format);
}
