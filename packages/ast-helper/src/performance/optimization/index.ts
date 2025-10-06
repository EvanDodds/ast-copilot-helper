/**
 * Performance Optimization Module - Main Exports
 * Part of Issue #150 - Performance Optimization Component
 */

// Export all types
export * from "./types.js";

// Export main components
export { PerformanceOptimizer } from "./performance-optimizer.js";
export { MemoryManager } from "./memory-manager.js";
export { CacheManager } from "./cache-manager.js";
export { BatchProcessor } from "./batch-processor.js";

// Export monitoring utilities
export {
  SystemResourceMonitor,
  PerformanceAlertManager,
  PerformanceTrendAnalyzer,
} from "./monitoring.js";
