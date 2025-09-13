import { EventEmitter } from 'events';
import { logger } from '../logging/logger';
import type { MCPResource, ResourceValidationResult, ResourceMetadata } from './protocol/types';

/**
 * Resource execution statistics for performance monitoring
 */
export interface ResourceExecutionStats {
  accessCount: number;
  totalAccessTime: number;
  averageAccessTime: number;
  successRate: number;
  lastAccessed?: Date;
  errorCount: number;
  lastError?: Error;
  cacheHitRate: number;
}

/**
 * Resource registration options
 */
export interface ResourceRegistrationOptions {
  /** Override validation during registration */
  skipValidation?: boolean;
  /** Category for organizing resources */
  category?: string;
  /** Tags for resource discovery */
  tags?: string[];
  /** Resource-specific configuration */
  config?: Record<string, any>;
  /** Enable caching for this resource */
  cacheable?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Resource discovery criteria
 */
export interface ResourceDiscoveryOptions {
  category?: string;
  tags?: string[];
  uri?: string;
  mimeType?: string;
  includeDisabled?: boolean;
  pattern?: string;
}

/**
 * Resource cache entry
 */
interface ResourceCacheEntry {
  content: any;
  timestamp: Date;
  ttl: number;
  accessCount: number;
}

/**
 * Comprehensive resource registry with validation, caching, and discovery capabilities
 */
export class MCPResourceRegistry extends EventEmitter {
  private resources = new Map<string, MCPResource>();
  private metadata = new Map<string, ResourceMetadata>();
  private stats = new Map<string, ResourceExecutionStats>();
  private disabledResources = new Set<string>();
  private categories = new Map<string, Set<string>>();
  private tags = new Map<string, Set<string>>();
  private mimeTypes = new Map<string, Set<string>>();
  private cache = new Map<string, ResourceCacheEntry>();
  private readonly maxAccessTime: number;
  private readonly defaultCacheTtl: number;
  private readonly maxCacheSize: number;

  constructor(options: { 
    maxAccessTime?: number;
    defaultCacheTtl?: number;
    maxCacheSize?: number;
  } = {}) {
    super();
    this.maxAccessTime = options.maxAccessTime ?? 100; // 100ms default per performance requirements
    this.defaultCacheTtl = options.defaultCacheTtl ?? 300000; // 5 minutes default
    this.maxCacheSize = options.maxCacheSize ?? 1000; // Max 1000 cached resources
    
    // Cleanup cache periodically
    setInterval(() => this.cleanupCache(), 60000); // Every minute
    
    logger.info('MCP Resource Registry initialized', {
      maxAccessTime: this.maxAccessTime,
      defaultCacheTtl: this.defaultCacheTtl,
      maxCacheSize: this.maxCacheSize,
      registeredResources: 0
    });
  }

  /**
   * Register a new resource with comprehensive validation
   */
  async registerResource(
    resource: MCPResource,
    options: ResourceRegistrationOptions = {}
  ): Promise<void> {
    try {
      // Validate resource before registration
      if (!options.skipValidation) {
        const validation = await this.validateResource(resource);
        if (!validation.isValid) {
          throw new Error(`Resource validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Check for URI conflicts
      if (this.resources.has(resource.uri)) {
        throw new Error(`Resource with URI '${resource.uri}' is already registered`);
      }

      // Register the resource
      this.resources.set(resource.uri, resource);
      
      // Initialize metadata
      const metadata: ResourceMetadata = {
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        category: options.category || 'general',
        tags: options.tags || [],
        registeredAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        author: 'AST MCP Server',
        config: options.config || {},
        cacheable: options.cacheable ?? false,
        cacheTtl: options.cacheTtl ?? this.defaultCacheTtl
      };
      this.metadata.set(resource.uri, metadata);

      // Initialize statistics
      this.stats.set(resource.uri, {
        accessCount: 0,
        totalAccessTime: 0,
        averageAccessTime: 0,
        successRate: 1.0,
        errorCount: 0,
        cacheHitRate: 0
      });

      // Update category mapping
      if (options.category) {
        if (!this.categories.has(options.category)) {
          this.categories.set(options.category, new Set());
        }
        this.categories.get(options.category)!.add(resource.uri);
      }

      // Update tags mapping
      if (options.tags) {
        for (const tag of options.tags) {
          if (!this.tags.has(tag)) {
            this.tags.set(tag, new Set());
          }
          this.tags.get(tag)!.add(resource.uri);
        }
      }

      // Update MIME type mapping
      if (resource.mimeType) {
        if (!this.mimeTypes.has(resource.mimeType)) {
          this.mimeTypes.set(resource.mimeType, new Set());
        }
        this.mimeTypes.get(resource.mimeType)!.add(resource.uri);
      }

      this.emit('resource-registered', resource.uri, metadata);
      
      logger.info('Resource registered successfully', {
        resourceUri: resource.uri,
        resourceName: resource.name,
        category: metadata.category,
        tags: metadata.tags,
        mimeType: resource.mimeType,
        cacheable: metadata.cacheable
      });
    } catch (error) {
      logger.error('Failed to register resource', {
        resourceUri: resource.uri,
        resourceName: resource.name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Unregister a resource and clean up all associated data
   */
  unregisterResource(resourceUri: string): boolean {
    if (!this.resources.has(resourceUri)) {
      return false;
    }

    const metadata = this.metadata.get(resourceUri);
    
    // Remove from all data structures
    this.resources.delete(resourceUri);
    this.metadata.delete(resourceUri);
    this.stats.delete(resourceUri);
    this.disabledResources.delete(resourceUri);
    this.cache.delete(resourceUri);

    // Clean up category mapping
    if (metadata?.category) {
      const categoryResources = this.categories.get(metadata.category);
      if (categoryResources) {
        categoryResources.delete(resourceUri);
        if (categoryResources.size === 0) {
          this.categories.delete(metadata.category);
        }
      }
    }

    // Clean up tags mapping
    if (metadata?.tags) {
      for (const tag of metadata.tags) {
        const tagResources = this.tags.get(tag);
        if (tagResources) {
          tagResources.delete(resourceUri);
          if (tagResources.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    // Clean up MIME type mapping
    const resource = this.resources.get(resourceUri);
    if (resource?.mimeType) {
      const mimeTypeResources = this.mimeTypes.get(resource.mimeType);
      if (mimeTypeResources) {
        mimeTypeResources.delete(resourceUri);
        if (mimeTypeResources.size === 0) {
          this.mimeTypes.delete(resource.mimeType);
        }
      }
    }

    this.emit('resource-unregistered', resourceUri);
    
    logger.info('Resource unregistered successfully', { resourceUri });
    return true;
  }

  /**
   * Get all registered resources
   */
  getAllResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources matching discovery criteria
   */
  discoverResources(options: ResourceDiscoveryOptions = {}): MCPResource[] {
    let candidateUris = new Set(this.resources.keys());

    // Filter by URI (exact match)
    if (options.uri) {
      candidateUris = new Set([options.uri].filter(uri => candidateUris.has(uri)));
    }

    // Filter by pattern (regex or glob-like)
    if (options.pattern) {
      const pattern = new RegExp(options.pattern.replace(/\*/g, '.*'), 'i');
      candidateUris = new Set(
        Array.from(candidateUris).filter(uri => pattern.test(uri))
      );
    }

    // Filter by category
    if (options.category) {
      const categoryResources = this.categories.get(options.category) || new Set();
      candidateUris = new Set(Array.from(candidateUris).filter(uri => categoryResources.has(uri)));
    }

    // Filter by tags (intersection)
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        const tagResources = this.tags.get(tag) || new Set();
        candidateUris = new Set(Array.from(candidateUris).filter(uri => tagResources.has(uri)));
      }
    }

    // Filter by MIME type
    if (options.mimeType) {
      const mimeTypeResources = this.mimeTypes.get(options.mimeType) || new Set();
      candidateUris = new Set(Array.from(candidateUris).filter(uri => mimeTypeResources.has(uri)));
    }

    // Filter disabled resources unless explicitly included
    if (!options.includeDisabled) {
      candidateUris = new Set(
        Array.from(candidateUris).filter(uri => !this.disabledResources.has(uri))
      );
    }

    return Array.from(candidateUris)
      .map(uri => this.resources.get(uri)!)
      .filter(resource => resource !== undefined);
  }

  /**
   * Get resource by URI
   */
  getResource(resourceUri: string): MCPResource | undefined {
    return this.resources.get(resourceUri);
  }

  /**
   * Get resource metadata
   */
  getResourceMetadata(resourceUri: string): ResourceMetadata | undefined {
    return this.metadata.get(resourceUri);
  }

  /**
   * Get resource execution statistics
   */
  getResourceStats(resourceUri: string): ResourceExecutionStats | undefined {
    return this.stats.get(resourceUri);
  }

  /**
   * Access a resource with comprehensive caching and performance tracking
   */
  async accessResource(
    resourceUri: string,
    params?: Record<string, any>
  ): Promise<any> {
    const startTime = Date.now();
    const resource = this.resources.get(resourceUri);
    const metadata = this.metadata.get(resourceUri);
    const stats = this.stats.get(resourceUri);

    if (!resource || !metadata || !stats) {
      throw new Error(`Resource '${resourceUri}' not found`);
    }

    if (this.disabledResources.has(resourceUri)) {
      throw new Error(`Resource '${resourceUri}' is disabled`);
    }

    try {
      // Check cache first if resource is cacheable
      let result: any;
      let cacheHit = false;

      if (metadata.cacheable) {
        const cacheKey = this.getCacheKey(resourceUri, params);
        const cachedEntry = this.cache.get(cacheKey);
        
        if (cachedEntry && Date.now() - cachedEntry.timestamp.getTime() < cachedEntry.ttl) {
          result = cachedEntry.content;
          cacheHit = true;
          cachedEntry.accessCount++;
          
          logger.debug('Resource cache hit', { resourceUri, cacheKey });
        }
      }

      if (!cacheHit) {
        // Set up access timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Resource access timeout')), this.maxAccessTime)
        );

        const accessPromise = (resource as any).handler 
          ? (resource as any).handler(params)
          : this.defaultResourceHandler(resource, params);

        // Race between access and timeout
        result = await Promise.race([accessPromise, timeoutPromise]);

        // Cache the result if resource is cacheable
        if (metadata.cacheable) {
          this.cacheResource(resourceUri, params, result, metadata.cacheTtl);
        }
      }

      // Update statistics on success
      const accessTime = Date.now() - startTime;
      stats.accessCount++;
      stats.totalAccessTime += accessTime;
      stats.averageAccessTime = stats.totalAccessTime / stats.accessCount;
      stats.successRate = (stats.accessCount - stats.errorCount) / stats.accessCount;
      stats.lastAccessed = new Date();
      
      // Update cache hit rate
      const totalCacheAccess = cacheHit ? 1 : 0;
      stats.cacheHitRate = (stats.cacheHitRate * (stats.accessCount - 1) + totalCacheAccess) / stats.accessCount;

      this.emit('resource-accessed', resourceUri, accessTime, result, cacheHit);

      logger.info('Resource accessed successfully', {
        resourceUri,
        accessTime,
        cacheHit,
        resultSize: this.getResultSize(result)
      });

      return result;
    } catch (error) {
      // Update error statistics
      const accessTime = Date.now() - startTime;
      stats.accessCount++;
      stats.errorCount++;
      stats.totalAccessTime += accessTime;
      stats.averageAccessTime = stats.totalAccessTime / stats.accessCount;
      stats.successRate = (stats.accessCount - stats.errorCount) / stats.accessCount;
      stats.lastError = error instanceof Error ? error : new Error(String(error));
      stats.lastAccessed = new Date();

      this.emit('resource-error', resourceUri, error);

      logger.error('Resource access failed', {
        resourceUri,
        accessTime,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Enable or disable a resource
   */
  setResourceEnabled(resourceUri: string, enabled: boolean): boolean {
    if (!this.resources.has(resourceUri)) {
      return false;
    }

    if (enabled) {
      this.disabledResources.delete(resourceUri);
      this.emit('resource-enabled', resourceUri);
      logger.info('Resource enabled', { resourceUri });
    } else {
      this.disabledResources.add(resourceUri);
      this.emit('resource-disabled', resourceUri);
      logger.info('Resource disabled', { resourceUri });
    }

    return true;
  }

  /**
   * Check if a resource is enabled
   */
  isResourceEnabled(resourceUri: string): boolean {
    return this.resources.has(resourceUri) && !this.disabledResources.has(resourceUri);
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all available tags
   */
  getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Get all available MIME types
   */
  getMimeTypes(): string[] {
    return Array.from(this.mimeTypes.keys());
  }

  /**
   * Get resources in a specific category
   */
  getResourcesByCategory(category: string): MCPResource[] {
    const resourceUris = this.categories.get(category) || new Set();
    return Array.from(resourceUris)
      .map(uri => this.resources.get(uri)!)
      .filter(resource => resource !== undefined);
  }

  /**
   * Get resources with a specific tag
   */
  getResourcesByTag(tag: string): MCPResource[] {
    const resourceUris = this.tags.get(tag) || new Set();
    return Array.from(resourceUris)
      .map(uri => this.resources.get(uri)!)
      .filter(resource => resource !== undefined);
  }

  /**
   * Get resources with a specific MIME type
   */
  getResourcesByMimeType(mimeType: string): MCPResource[] {
    const resourceUris = this.mimeTypes.get(mimeType) || new Set();
    return Array.from(resourceUris)
      .map(uri => this.resources.get(uri)!)
      .filter(resource => resource !== undefined);
  }

  /**
   * Clear all execution statistics
   */
  clearStats(): void {
    for (const [, stats] of this.stats.entries()) {
      stats.accessCount = 0;
      stats.totalAccessTime = 0;
      stats.averageAccessTime = 0;
      stats.successRate = 1.0;
      stats.errorCount = 0;
      stats.cacheHitRate = 0;
      delete stats.lastAccessed;
      delete stats.lastError;
    }
    
    this.emit('stats-cleared');
    logger.info('Resource execution statistics cleared');
  }

  /**
   * Clear resource cache
   */
  clearCache(resourceUri?: string): void {
    if (resourceUri) {
      // Clear cache for specific resource
      const keysToDelete: string[] = [];
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`${resourceUri}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
      
      logger.info('Resource cache cleared', { resourceUri });
    } else {
      // Clear entire cache
      this.cache.clear();
      logger.info('All resource cache cleared');
    }
    
    this.emit('cache-cleared', resourceUri);
  }

  /**
   * Get registry summary
   */
  getSummary(): {
    totalResources: number;
    enabledResources: number;
    disabledResources: number;
    categories: number;
    tags: number;
    mimeTypes: number;
    totalAccesses: number;
    averageSuccessRate: number;
    cacheSize: number;
    averageCacheHitRate: number;
  } {
    const totalAccesses = Array.from(this.stats.values())
      .reduce((sum, stats) => sum + stats.accessCount, 0);

    const averageSuccessRate = this.stats.size > 0
      ? Array.from(this.stats.values())
          .reduce((sum, stats) => sum + stats.successRate, 0) / this.stats.size
      : 1.0;

    const averageCacheHitRate = this.stats.size > 0
      ? Array.from(this.stats.values())
          .reduce((sum, stats) => sum + stats.cacheHitRate, 0) / this.stats.size
      : 0;

    return {
      totalResources: this.resources.size,
      enabledResources: this.resources.size - this.disabledResources.size,
      disabledResources: this.disabledResources.size,
      categories: this.categories.size,
      tags: this.tags.size,
      mimeTypes: this.mimeTypes.size,
      totalAccesses,
      averageSuccessRate,
      cacheSize: this.cache.size,
      averageCacheHitRate
    };
  }

  /**
   * Validate a resource definition
   */
  private async validateResource(resource: MCPResource): Promise<ResourceValidationResult> {
    const errors: string[] = [];

    // Basic validation
    if (!resource.uri || typeof resource.uri !== 'string') {
      errors.push('Resource URI is required and must be a string');
    }

    if (!resource.name || typeof resource.name !== 'string') {
      errors.push('Resource name is required and must be a string');
    }

    if (!resource.description || typeof resource.description !== 'string') {
      errors.push('Resource description is required and must be a string');
    }

    // Validate URI format (basic check)
    if (resource.uri && !this.isValidUri(resource.uri)) {
      errors.push('Resource URI format is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Basic URI validation
   */
  private isValidUri(uri: string): boolean {
    try {
      // Simple URI validation - should contain scheme or be relative path
      return uri.includes(':') || uri.startsWith('/') || uri.startsWith('./') || uri.startsWith('../');
    } catch {
      return false;
    }
  }

  /**
   * Default resource handler when no custom handler is provided
   */
  private async defaultResourceHandler(resource: MCPResource, params?: Record<string, any>): Promise<any> {
    // This is a basic implementation that could be extended based on resource type
    return {
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
      content: `Default content for resource: ${resource.name}`,
      params: params || {}
    };
  }

  /**
   * Generate cache key for resource access
   */
  private getCacheKey(resourceUri: string, params?: Record<string, any>): string {
    const paramsStr = params ? JSON.stringify(params, Object.keys(params).sort()) : '';
    return `${resourceUri}:${paramsStr}`;
  }

  /**
   * Cache resource result
   */
  private cacheResource(
    resourceUri: string,
    params: Record<string, any> | undefined,
    result: any,
    ttl: number
  ): void {
    const cacheKey = this.getCacheKey(resourceUri, params);
    
    // Ensure cache size limit before adding new entry
    while (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    this.cache.set(cacheKey, {
      content: result,
      timestamp: new Date(),
      ttl,
      accessCount: 1
    });

    logger.debug('Resource result cached', { resourceUri, cacheKey, ttl });
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTimestamp) {
        oldestTimestamp = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted oldest cache entry', { cacheKey: oldestKey });
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug('Cleaned up expired cache entries', { count: keysToDelete.length });
    }
  }

  /**
   * Get approximate size of result for logging
   */
  private getResultSize(result: any): number {
    try {
      return JSON.stringify(result).length;
    } catch {
      return 0;
    }
  }
}