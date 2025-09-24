/**
 * @fileoverview Types for diagnostic data collection system
 * @module @ast-copilot-helper/ast-helper/error-reporting/diagnostics/types
 */

import type {
  DiagnosticData,
  SystemDiagnostics as BaseSystemDiagnostics,
  RuntimeDiagnostics as BaseRuntimeDiagnostics,
  CodebaseDiagnostics as BaseCodebaseDiagnostics,
} from "../types.js";

/**
 * Diagnostic scope types
 */
export type DiagnosticScope =
  | "system"
  | "runtime"
  | "codebase"
  | "configuration"
  | "performance"
  | "dependencies";

/**
 * Base interface for diagnostic collectors
 */
export interface DiagnosticCollector {
  readonly name: string;
  readonly scope: DiagnosticScope;
  readonly priority: number;
  readonly cacheTTL?: number;

  /**
   * Collect diagnostic data
   */
  collect(): Promise<Partial<DiagnosticData>>;

  /**
   * Check if collector can run safely
   */
  canCollect(): Promise<boolean>;

  /**
   * Get estimated collection time in milliseconds
   */
  estimateCollectionTime(): number;
}

/**
 * Extended system diagnostics - using base types
 */
export type SystemDiagnostics = BaseSystemDiagnostics;

/**
 * Extended runtime diagnostics - using base types
 */
export type RuntimeDiagnostics = BaseRuntimeDiagnostics;

/**
 * Extended codebase diagnostics - using base types
 */
export type CodebaseDiagnostics = BaseCodebaseDiagnostics;

/**
 * Configuration for diagnostic collectors
 */
export interface DiagnosticCollectorConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  cacheTTL: number;
  privacyLevel: "minimal" | "standard" | "full";
  includeEnvironment: boolean;
  includeFileSystem: boolean;
  includeGitInfo: boolean;
  includeNetworkInfo: boolean;
  excludePatterns: string[];
  maxFileSize: number;
  maxDirectoryDepth: number;
  performanceThreshold: number;
}

/**
 * Cache entry for diagnostic data
 */
export interface DiagnosticCacheEntry {
  data: Partial<DiagnosticData>;
  timestamp: number;
  ttl: number;
  collector: string;
  version: string;
}

/**
 * Collection context and metadata
 */
export interface DiagnosticCollectionContext {
  triggeredBy: "error" | "manual" | "scheduled" | "crash";
  timestamp: number;
  sessionId: string;
  userId?: string;
  errorId?: string;
  requestId?: string;
  timeout: number;
  privacyLevel: "minimal" | "standard" | "full";
  includeCache: boolean;
  forceRefresh: boolean;
  collectors: string[];
}

/**
 * Collection result with metadata
 */
export interface DiagnosticCollectionResult {
  success: boolean;
  data?: Partial<DiagnosticData>[];
  errors?: Array<{
    collector: string;
    error: Error;
    duration: number;
  }>;
  duration: number;
  cached: number;
  collected: number;
  skipped: number;
  metadata: {
    context: DiagnosticCollectionContext;
    performance: {
      totalTime: number;
      slowestCollector: string;
      fastestCollector: string;
      averageTime: number;
    };
    privacy: {
      level: string;
      anonymized: boolean;
      excludedFields: string[];
    };
  };
}

/**
 * Performance monitoring for collectors
 */
export interface CollectorPerformanceMetrics {
  collector: string;
  totalRuns: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  lastRun: number;
  errors: number;
  cacheHitRate: number;
}

/**
 * Privacy filter interface
 */
export interface PrivacyFilter {
  level: "minimal" | "standard" | "full";

  /**
   * Filter diagnostic data based on privacy level
   */
  filter(data: Partial<DiagnosticData>): Partial<DiagnosticData>;

  /**
   * Check if field should be included
   */
  shouldIncludeField(fieldPath: string, value: any): boolean;

  /**
   * Anonymize sensitive data
   */
  anonymize(value: any): any;
}

/**
 * Events emitted by diagnostic collectors
 */
export interface DiagnosticCollectorEvents {
  "collection:start": {
    context: DiagnosticCollectionContext;
    collectors: string[];
  };

  "collection:complete": {
    result: DiagnosticCollectionResult;
  };

  "collection:error": {
    collector: string;
    error: Error;
    context: DiagnosticCollectionContext;
  };

  "collector:start": {
    collector: string;
    context: DiagnosticCollectionContext;
  };

  "collector:complete": {
    collector: string;
    data: Partial<DiagnosticData>;
    duration: number;
    cached: boolean;
  };

  "collector:error": {
    collector: string;
    error: Error;
    duration: number;
  };

  "cache:hit": {
    collector: string;
    age: number;
  };

  "cache:miss": {
    collector: string;
    reason: string;
  };

  "cache:clear": {
    collector?: string;
    count: number;
  };
}
