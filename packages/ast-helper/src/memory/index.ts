/**
 * Memory management and resource optimization module
 * 
 * This module provides comprehensive memory management capabilities including:
 * - Resource usage monitoring and alerting  
 * - Memory leak detection and analysis
 * - Resource pool management (connections, workers, files)
 * - Garbage collection optimization
 * - Performance metrics collection and analysis
 * - Vector storage and cache optimization
 */

export * from './types.js';
export * from './resource-manager.js';
export * from './monitor.js';
export * from './leak-detector.js';
export * from './gc-scheduler.js';
export * from './metrics-collector.js';
export * from './memory-manager.js';
export * from './pools/index.js';

// Re-export the main resource manager as default
export { AdvancedResourceManager as default } from './resource-manager.js';