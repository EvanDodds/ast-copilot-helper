import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPResourceRegistry } from '../resource-registry';
import type { MCPResource, ResourceMetadata } from '../protocol/types';

// Mock logger to avoid console output during tests
vi.mock('../../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('MCPResourceRegistry', () => {
  let registry: MCPResourceRegistry;

  const mockResource: MCPResource = {
    uri: 'file:///test/resource.txt',
    name: 'Test Resource',
    description: 'A test resource for unit testing',
    mimeType: 'text/plain'
  };

  const mockResourceWithHandler = {
    ...mockResource,
    uri: 'handler://test/resource',
    handler: vi.fn().mockResolvedValue('handler result')
  };

  beforeEach(() => {
    registry = new MCPResourceRegistry({
      maxAccessTime: 100,
      defaultCacheTtl: 1000,
      maxCacheSize: 10
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear any intervals
    registry.removeAllListeners();
  });

  describe('Resource Registration', () => {
    it('should register a resource successfully', async () => {
      await registry.registerResource(mockResource);

      const registered = registry.getResource(mockResource.uri);
      expect(registered).toEqual(mockResource);
    });

    it('should register a resource with options', async () => {
      const options = {
        category: 'test',
        tags: ['tag1', 'tag2'],
        config: { test: true },
        cacheable: true,
        cacheTtl: 5000
      };

      await registry.registerResource(mockResource, options);

      const metadata = registry.getResourceMetadata(mockResource.uri);
      expect(metadata).toBeDefined();
      expect(metadata?.category).toBe('test');
      expect(metadata?.tags).toEqual(['tag1', 'tag2']);
      expect(metadata?.cacheable).toBe(true);
      expect(metadata?.cacheTtl).toBe(5000);
    });

    it('should emit resource-registered event', async () => {
      const eventSpy = vi.fn();
      registry.on('resource-registered', eventSpy);

      await registry.registerResource(mockResource);

      expect(eventSpy).toHaveBeenCalledWith(
        mockResource.uri,
        expect.any(Object)
      );
    });

    it('should throw error for duplicate URI registration', async () => {
      await registry.registerResource(mockResource);

      await expect(
        registry.registerResource(mockResource)
      ).rejects.toThrow(`Resource with URI '${mockResource.uri}' is already registered`);
    });

    it('should validate resource during registration', async () => {
      const invalidResource = {
        uri: '',
        name: '',
        description: '',
        mimeType: 'text/plain'
      };

      await expect(
        registry.registerResource(invalidResource as MCPResource)
      ).rejects.toThrow('Resource validation failed');
    });

    it('should skip validation when requested', async () => {
      const invalidResource = {
        uri: '',
        name: '',
        description: '',
        mimeType: 'text/plain'
      };

      // Should not throw when skipping validation
      await registry.registerResource(invalidResource as MCPResource, {
        skipValidation: true
      });

      const registered = registry.getResource(invalidResource.uri);
      expect(registered).toEqual(invalidResource);
    });
  });

  describe('Resource Unregistration', () => {
    beforeEach(async () => {
      await registry.registerResource(mockResource, {
        category: 'test',
        tags: ['tag1']
      });
    });

    it('should unregister a resource successfully', () => {
      const result = registry.unregisterResource(mockResource.uri);

      expect(result).toBe(true);
      expect(registry.getResource(mockResource.uri)).toBeUndefined();
    });

    it('should emit resource-unregistered event', () => {
      const eventSpy = vi.fn();
      registry.on('resource-unregistered', eventSpy);

      registry.unregisterResource(mockResource.uri);

      expect(eventSpy).toHaveBeenCalledWith(mockResource.uri);
    });

    it('should return false for non-existent resource', () => {
      const result = registry.unregisterResource('non-existent');

      expect(result).toBe(false);
    });

    it('should clean up all associated data', () => {
      registry.unregisterResource(mockResource.uri);

      expect(registry.getResourceMetadata(mockResource.uri)).toBeUndefined();
      expect(registry.getResourceStats(mockResource.uri)).toBeUndefined();
      expect(registry.getResourcesByCategory('test')).toHaveLength(0);
      expect(registry.getResourcesByTag('tag1')).toHaveLength(0);
    });
  });

  describe('Resource Discovery', () => {
    beforeEach(async () => {
      await registry.registerResource({
        uri: 'file:///docs/readme.md',
        name: 'README',
        description: 'Documentation file',
        mimeType: 'text/markdown'
      }, { category: 'docs', tags: ['documentation'] });

      await registry.registerResource({
        uri: 'file:///src/main.ts',
        name: 'Main Source',
        description: 'Main TypeScript file',
        mimeType: 'text/typescript'
      }, { category: 'source', tags: ['code'] });

      await registry.registerResource({
        uri: 'http://api.example.com/data',
        name: 'API Data',
        description: 'Remote API endpoint',
        mimeType: 'application/json'
      }, { category: 'api', tags: ['remote'] });
    });

    it('should discover all resources', () => {
      const resources = registry.discoverResources();
      expect(resources).toHaveLength(3);
    });

    it('should discover resources by category', () => {
      const docsResources = registry.discoverResources({ category: 'docs' });
      expect(docsResources).toHaveLength(1);
      expect(docsResources[0].name).toBe('README');
    });

    it('should discover resources by tags', () => {
      const codeResources = registry.discoverResources({ tags: ['code'] });
      expect(codeResources).toHaveLength(1);
      expect(codeResources[0].name).toBe('Main Source');
    });

    it('should discover resources by multiple tags (intersection)', () => {
      const resources = registry.discoverResources({ 
        tags: ['documentation', 'nonexistent'] 
      });
      expect(resources).toHaveLength(0);
    });

    it('should discover resources by MIME type', () => {
      const markdownResources = registry.discoverResources({ 
        mimeType: 'text/markdown' 
      });
      expect(markdownResources).toHaveLength(1);
      expect(markdownResources[0].name).toBe('README');
    });

    it('should discover resources by URI exact match', () => {
      const resources = registry.discoverResources({ 
        uri: 'file:///src/main.ts' 
      });
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('Main Source');
    });

    it('should discover resources by pattern', () => {
      const fileResources = registry.discoverResources({ 
        pattern: 'file://*' 
      });
      expect(fileResources).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const resources = registry.discoverResources({
        category: 'docs',
        tags: ['documentation'],
        mimeType: 'text/markdown'
      });
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('README');
    });

    it('should exclude disabled resources by default', async () => {
      await registry.registerResource({
        uri: 'disabled://resource',
        name: 'Disabled Resource',
        description: 'This will be disabled',
        mimeType: 'text/plain'
      });
      
      registry.setResourceEnabled('disabled://resource', false);
      
      const allResources = registry.discoverResources();
      const disabledUri = allResources.find(r => r.uri === 'disabled://resource');
      expect(disabledUri).toBeUndefined();
    });

    it('should include disabled resources when requested', async () => {
      await registry.registerResource({
        uri: 'disabled://resource',
        name: 'Disabled Resource',
        description: 'This will be disabled',
        mimeType: 'text/plain'
      });
      
      registry.setResourceEnabled('disabled://resource', false);
      
      const allResources = registry.discoverResources({ includeDisabled: true });
      const disabledResource = allResources.find(r => r.uri === 'disabled://resource');
      expect(disabledResource).toBeDefined();
    });
  });

  describe('Resource Access', () => {
    beforeEach(async () => {
      await registry.registerResource(mockResourceWithHandler, {
        cacheable: true,
        cacheTtl: 1000
      });
    });

    it('should access resource successfully', async () => {
      const result = await registry.accessResource(mockResourceWithHandler.uri);
      
      expect(result).toBe('handler result');
      expect(mockResourceWithHandler.handler).toHaveBeenCalledWith(undefined);
    });

    it('should access resource with parameters', async () => {
      const params = { param1: 'value1' };
      
      await registry.accessResource(mockResourceWithHandler.uri, params);
      
      expect(mockResourceWithHandler.handler).toHaveBeenCalledWith(params);
    });

    it('should cache resource results', async () => {
      // First access
      await registry.accessResource(mockResourceWithHandler.uri);
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(1);

      // Second access should use cache
      await registry.accessResource(mockResourceWithHandler.uri);
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should update access statistics', async () => {
      await registry.accessResource(mockResourceWithHandler.uri);
      
      const stats = registry.getResourceStats(mockResourceWithHandler.uri);
      expect(stats).toBeDefined();
      expect(stats!.accessCount).toBe(1);
      expect(stats!.successRate).toBe(1.0);
      expect(stats!.lastAccessed).toBeInstanceOf(Date);
    });

    it('should emit resource-accessed event', async () => {
      const eventSpy = vi.fn();
      registry.on('resource-accessed', eventSpy);

      await registry.accessResource(mockResourceWithHandler.uri);

      expect(eventSpy).toHaveBeenCalledWith(
        mockResourceWithHandler.uri,
        expect.any(Number), // access time
        'handler result',
        false // cache hit
      );
    });

    it('should timeout on slow resources', async () => {
      const slowResource = {
        ...mockResource,
        uri: 'slow://resource',
        handler: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 200))
        )
      };

      await registry.registerResource(slowResource);

      await expect(
        registry.accessResource(slowResource.uri)
      ).rejects.toThrow('Resource access timeout');
    });

    it('should handle resource access errors', async () => {
      const errorResource = {
        ...mockResource,
        uri: 'error://resource',
        handler: vi.fn().mockRejectedValue(new Error('Access error'))
      };

      await registry.registerResource(errorResource);

      await expect(
        registry.accessResource(errorResource.uri)
      ).rejects.toThrow('Access error');

      const stats = registry.getResourceStats(errorResource.uri);
      expect(stats!.errorCount).toBe(1);
      expect(stats!.lastError).toBeDefined();
    });

    it('should throw error for non-existent resource', async () => {
      await expect(
        registry.accessResource('non-existent')
      ).rejects.toThrow(`Resource 'non-existent' not found`);
    });

    it('should throw error for disabled resource', async () => {
      registry.setResourceEnabled(mockResourceWithHandler.uri, false);

      await expect(
        registry.accessResource(mockResourceWithHandler.uri)
      ).rejects.toThrow(`Resource '${mockResourceWithHandler.uri}' is disabled`);
    });

    it('should use default handler when no handler provided', async () => {
      const resourceWithoutHandler = {
        uri: 'no-handler://resource',
        name: 'No Handler Resource',
        description: 'Resource without custom handler',
        mimeType: 'text/plain'
      };

      await registry.registerResource(resourceWithoutHandler);

      const result = await registry.accessResource(resourceWithoutHandler.uri);

      expect(result).toBeDefined();
      expect(result.uri).toBe(resourceWithoutHandler.uri);
      expect(result.name).toBe(resourceWithoutHandler.name);
      expect(result.content).toContain('Default content for resource');
    });
  });

  describe('Resource Caching', () => {
    beforeEach(async () => {
      await registry.registerResource(mockResourceWithHandler, {
        cacheable: true,
        cacheTtl: 1000
      });
    });

    it('should cache resource results', async () => {
      await registry.accessResource(mockResourceWithHandler.uri, { param: 'value' });
      
      // Second access with same params should hit cache
      await registry.accessResource(mockResourceWithHandler.uri, { param: 'value' });
      
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(1);
    });

    it('should not cache results with different parameters', async () => {
      await registry.accessResource(mockResourceWithHandler.uri, { param: 'value1' });
      await registry.accessResource(mockResourceWithHandler.uri, { param: 'value2' });
      
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(2);
    });

    it('should clear specific resource cache', async () => {
      await registry.accessResource(mockResourceWithHandler.uri);
      registry.clearCache(mockResourceWithHandler.uri);
      
      // Should call handler again after cache clear
      await registry.accessResource(mockResourceWithHandler.uri);
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      await registry.accessResource(mockResourceWithHandler.uri);
      registry.clearCache();
      
      // Should call handler again after cache clear
      await registry.accessResource(mockResourceWithHandler.uri);
      expect(mockResourceWithHandler.handler).toHaveBeenCalledTimes(2);
    });

    it('should update cache hit rate statistics', async () => {
      await registry.accessResource(mockResourceWithHandler.uri); // Miss
      await registry.accessResource(mockResourceWithHandler.uri); // Hit
      
      const stats = registry.getResourceStats(mockResourceWithHandler.uri);
      expect(stats!.cacheHitRate).toBe(0.5); // 1 hit out of 2 accesses
    });

    it('should expire cached entries based on TTL', async () => {
      // Register with very short TTL
      const shortTtlResource = {
        ...mockResourceWithHandler,
        uri: 'short-ttl://resource',
        handler: vi.fn().mockResolvedValue('result')
      };

      await registry.registerResource(shortTtlResource, {
        cacheable: true,
        cacheTtl: 10 // 10ms
      });

      await registry.accessResource(shortTtlResource.uri);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      await registry.accessResource(shortTtlResource.uri);
      
      expect(shortTtlResource.handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource State Management', () => {
    beforeEach(async () => {
      await registry.registerResource(mockResource);
    });

    it('should enable and disable resources', () => {
      expect(registry.isResourceEnabled(mockResource.uri)).toBe(true);

      registry.setResourceEnabled(mockResource.uri, false);
      expect(registry.isResourceEnabled(mockResource.uri)).toBe(false);

      registry.setResourceEnabled(mockResource.uri, true);
      expect(registry.isResourceEnabled(mockResource.uri)).toBe(true);
    });

    it('should emit enable/disable events', () => {
      const enabledSpy = vi.fn();
      const disabledSpy = vi.fn();
      
      registry.on('resource-enabled', enabledSpy);
      registry.on('resource-disabled', disabledSpy);

      registry.setResourceEnabled(mockResource.uri, false);
      expect(disabledSpy).toHaveBeenCalledWith(mockResource.uri);

      registry.setResourceEnabled(mockResource.uri, true);
      expect(enabledSpy).toHaveBeenCalledWith(mockResource.uri);
    });

    it('should return false for non-existent resource state change', () => {
      const result = registry.setResourceEnabled('non-existent', false);
      expect(result).toBe(false);
    });
  });

  describe('Category and Tag Management', () => {
    beforeEach(async () => {
      await registry.registerResource({
        uri: 'cat1://resource1',
        name: 'Resource 1',
        description: 'First resource',
        mimeType: 'text/plain'
      }, { category: 'category1', tags: ['tag1', 'tag2'] });

      await registry.registerResource({
        uri: 'cat1://resource2',
        name: 'Resource 2',
        description: 'Second resource',
        mimeType: 'text/plain'
      }, { category: 'category1', tags: ['tag2', 'tag3'] });

      await registry.registerResource({
        uri: 'cat2://resource3',
        name: 'Resource 3',
        description: 'Third resource',
        mimeType: 'application/json'
      }, { category: 'category2', tags: ['tag1'] });
    });

    it('should get all categories', () => {
      const categories = registry.getCategories();
      expect(categories).toContain('category1');
      expect(categories).toContain('category2');
      expect(categories).toHaveLength(2);
    });

    it('should get all tags', () => {
      const tags = registry.getTags();
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag3');
      expect(tags).toHaveLength(3);
    });

    it('should get all MIME types', () => {
      const mimeTypes = registry.getMimeTypes();
      expect(mimeTypes).toContain('text/plain');
      expect(mimeTypes).toContain('application/json');
      expect(mimeTypes).toHaveLength(2);
    });

    it('should get resources by category', () => {
      const category1Resources = registry.getResourcesByCategory('category1');
      expect(category1Resources).toHaveLength(2);
      expect(category1Resources.map(r => r.name)).toContain('Resource 1');
      expect(category1Resources.map(r => r.name)).toContain('Resource 2');
    });

    it('should get resources by tag', () => {
      const tag1Resources = registry.getResourcesByTag('tag1');
      expect(tag1Resources).toHaveLength(2);
      expect(tag1Resources.map(r => r.name)).toContain('Resource 1');
      expect(tag1Resources.map(r => r.name)).toContain('Resource 3');
    });

    it('should get resources by MIME type', () => {
      const plainTextResources = registry.getResourcesByMimeType('text/plain');
      expect(plainTextResources).toHaveLength(2);
      expect(plainTextResources.map(r => r.name)).toContain('Resource 1');
      expect(plainTextResources.map(r => r.name)).toContain('Resource 2');
    });
  });

  describe('Statistics and Summary', () => {
    beforeEach(async () => {
      await registry.registerResource(mockResourceWithHandler, {
        category: 'test',
        tags: ['test-tag'],
        cacheable: true
      });

      await registry.registerResource({
        uri: 'second://resource',
        name: 'Second Resource',
        description: 'Second test resource',
        mimeType: 'application/json'
      }, { category: 'test' });
    });

    it('should provide registry summary', async () => {
      await registry.accessResource(mockResourceWithHandler.uri);
      registry.setResourceEnabled('second://resource', false);

      const summary = registry.getSummary();

      expect(summary.totalResources).toBe(2);
      expect(summary.enabledResources).toBe(1);
      expect(summary.disabledResources).toBe(1);
      expect(summary.categories).toBe(1);
      expect(summary.tags).toBe(1);
      expect(summary.totalAccesses).toBe(1);
    });

    it('should clear statistics', async () => {
      await registry.accessResource(mockResourceWithHandler.uri);
      
      let stats = registry.getResourceStats(mockResourceWithHandler.uri);
      expect(stats!.accessCount).toBe(1);

      registry.clearStats();
      
      stats = registry.getResourceStats(mockResourceWithHandler.uri);
      expect(stats!.accessCount).toBe(0);
    });

    it('should emit stats-cleared event', () => {
      const eventSpy = vi.fn();
      registry.on('stats-cleared', eventSpy);

      registry.clearStats();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle resource registration errors gracefully', async () => {
      const invalidResource = null as any;

      await expect(
        registry.registerResource(invalidResource)
      ).rejects.toThrow();
    });

    it('should emit resource-error events', async () => {
      const errorResource = {
        ...mockResource,
        uri: 'error://resource',
        handler: vi.fn().mockRejectedValue(new Error('Test error'))
      };

      await registry.registerResource(errorResource);

      const errorSpy = vi.fn();
      registry.on('resource-error', errorSpy);

      try {
        await registry.accessResource(errorResource.uri);
      } catch {
        // Expected error
      }

      expect(errorSpy).toHaveBeenCalledWith(
        errorResource.uri,
        expect.any(Error)
      );
    });
  });

  describe('Cache Management', () => {
    it('should enforce cache size limits', async () => {
      // Create a registry with max cache size of 2
      const smallCacheRegistry = new MCPResourceRegistry({
        maxCacheSize: 2,
        defaultCacheTtl: 10000
      });

      // Register 3 cacheable resources
      for (let i = 1; i <= 3; i++) {
        const resource = {
          uri: `cache-test://resource${i}`,
          name: `Resource ${i}`,
          description: `Test resource ${i}`,
          mimeType: 'text/plain',
          handler: vi.fn().mockResolvedValue(`result${i}`)
        };

        await smallCacheRegistry.registerResource(resource, { cacheable: true });
      }

      // Access all 3 resources
      await smallCacheRegistry.accessResource('cache-test://resource1');
      await smallCacheRegistry.accessResource('cache-test://resource2');
      await smallCacheRegistry.accessResource('cache-test://resource3'); // Should evict oldest

      // Access first resource again - should call handler since it was evicted
      await smallCacheRegistry.accessResource('cache-test://resource1');

      const summary = smallCacheRegistry.getSummary();
      expect(summary.cacheSize).toBeLessThanOrEqual(2);
    });

    it('should emit cache-cleared events', () => {
      const eventSpy = vi.fn();
      registry.on('cache-cleared', eventSpy);

      registry.clearCache('test://resource');
      expect(eventSpy).toHaveBeenCalledWith('test://resource');

      registry.clearCache();
      expect(eventSpy).toHaveBeenCalledWith(undefined);
    });
  });
});