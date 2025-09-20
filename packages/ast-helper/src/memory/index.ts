/**
 * Memory management and resource optimization module
 * 
 * This module provides comprehensive memory management capabilities including:
 * - Resource usage monitoring and alerting  
 * - Memory leak detection and analysis
 * - Resource pool management (connections, workers, files)
 * - Garbage collection optimization
 * - Vector storage and cache optimization
 */

export * from './types.js';
export * from './resource-manager.js';
export * from './monitor.js';

// Re-export the main resource manager as default
export { AdvancedResourceManager as default } from './resource-manager.js';