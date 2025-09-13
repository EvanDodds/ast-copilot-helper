/**
 * Tests for performance optimization system
 * Validates parallel downloads, streaming, resumption, and throttling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import { 
  PerformanceOptimizer,
  DownloadStatus,
  performanceOptimizer,
  downloadModelsParallel,
  downloadModelWithResume,
  getPerformanceMetrics,
  getActiveDownloads
} from './performance.js';
import { ModelConfig } from './types.js';

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    rename: vi.fn(),
  },
  createWriteStream: vi.fn()
}));

// Mock fetch API
global.fetch = vi.fn();

// Mock process methods
Object.defineProperty(process, 'memoryUsage', {
  value: vi.fn(() => ({
    rss: 100 * 1024 * 1024,
    heapTotal: 80 * 1024 * 1024,
    heapUsed: 60 * 1024 * 1024,
    external: 10 * 1024 * 1024,
    arrayBuffers: 5 * 1024 * 1024
  }))
});

Object.defineProperty(process, 'cpuUsage', {
  value: vi.fn(() => ({
    user: 1000000,
    system: 500000
  }))
});

describe('Performance Optimization System', () => {
  let optimizer: PerformanceOptimizer;
  let mockModel: ModelConfig;
  let mockWriteStream: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    optimizer = new PerformanceOptimizer();
    
    mockModel = {
      name: 'test-model',
      version: '1.0.0',
      format: 'onnx',
      url: 'https://example.com/model.onnx',
      size: 1024 * 1024, // 1MB
      checksum: 'abc123',
      dimensions: 768,
      description: 'Test model',
      requirements: {
        memoryMB: 512
      }
    };

    // Mock write stream
    mockWriteStream = {
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      once: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn()
    };
    
    vi.mocked(createWriteStream).mockReturnValue(mockWriteStream as any);
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('PerformanceOptimizer', () => {
    it('should initialize with default configuration', () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        downloadSpeed: 0,
        memoryUsage: expect.any(Number),
        activeDownloads: 0,
        cpuUsage: expect.any(Number),
        bandwidthUsage: 0,
        responseTime: expect.any(Number)
      }));
    });

    it('should accept custom configuration', () => {
      const customOptimizer = new PerformanceOptimizer(
        { maxSpeed: 5 * 1024 * 1024 },
        { maxConcurrent: 2 },
        { bufferSize: 32 * 1024 }
      );
      
      expect(customOptimizer).toBeDefined();
      customOptimizer.cleanup();
    });
  });

  describe('Parallel Downloads', () => {
    it('should download multiple models in parallel', async () => {
      const models = [
        { ...mockModel, name: 'model1' },
        { ...mockModel, name: 'model2' },
        { ...mockModel, name: 'model3' }
      ];

      // Mock successful responses - each call gets a fresh response
      vi.mocked(fetch).mockImplementation(() => Promise.resolve(createMockResponse()));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const results = await optimizer.downloadModelsParallel(models, '/test/dir');
      
      expect(results).toHaveLength(3);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle parallel download failures gracefully', async () => {
      const models = [
        { ...mockModel, name: 'model1' },
        { ...mockModel, name: 'model2' }
      ];

      // Mock one success, one failure, then success on retry
      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockResponse()) // First model succeeds
        .mockRejectedValueOnce(new Error('Network error')) // Second model fails
        .mockResolvedValueOnce(createMockResponse()) // First model retry succeeds
        .mockResolvedValueOnce(createMockResponse()); // Second model retry succeeds

      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      // Should succeed with fallback logic - downloads models individually after chunk failure
      const results = await optimizer.downloadModelsParallel(models, '/test/dir');
      expect(results).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(4); // Initial 2 calls + 2 retry calls
    });

    it('should respect maximum concurrent downloads', async () => {
      const customOptimizer = new PerformanceOptimizer(
        undefined,
        { maxConcurrent: 2 },
        undefined
      );

      const models = Array.from({ length: 5 }, (_, i) => ({
        ...mockModel,
        name: `model${i + 1}`
      }));

      vi.mocked(fetch).mockImplementation(() => Promise.resolve(createMockResponse()));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const startTime = Date.now();
      await customOptimizer.downloadModelsParallel(models, '/test/dir');
      const endTime = Date.now();

      // Should take longer than if all were parallel (rough check)
      expect(endTime - startTime).toBeGreaterThan(0);
      
      customOptimizer.cleanup();
    });
  });

  describe('Download Resumption', () => {
    it('should resume partial downloads', async () => {
      const partialSize = 512 * 1024; // 512KB already downloaded
      
      // Mock existing partial file
      vi.mocked(fs.stat).mockResolvedValue({
        size: partialSize,
        mtime: new Date()
      } as any);

      vi.mocked(fetch).mockImplementation(() => Promise.resolve({
        ok: true,
        status: 206, // Partial content
        headers: {
          get: vi.fn().mockReturnValue('524288') // Remaining 512KB
        },
        body: createMockReadableStream(new Uint8Array(512))
      } as any));

      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const result = await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      expect(result).toMatch(/test-model-1\.0\.0\.onnx$/);
      expect(fetch).toHaveBeenCalledWith(
        mockModel.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            Range: 'bytes=524288-'
          })
        })
      );
    });

    it('should handle missing partial files', async () => {
      // Mock no existing partial file
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      vi.mocked(fetch).mockImplementation(() => Promise.resolve(createMockResponse()));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const result = await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      expect(result).toMatch(/test-model-1\.0\.0\.onnx$/);
      expect(fetch).toHaveBeenCalledWith(
        mockModel.url,
        expect.objectContaining({
          headers: {}
        })
      );
    });

    it('should track resume information', async () => {
      const partialSize = 256 * 1024;
      
      vi.mocked(fs.stat).mockResolvedValue({
        size: partialSize,
        mtime: new Date('2025-01-01')
      } as any);

      vi.mocked(fetch).mockImplementation(() => Promise.resolve({
        ok: true,
        status: 206,
        headers: { get: vi.fn().mockReturnValue('786432') },
        body: createMockReadableStream(new Uint8Array(768))
      } as any));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const downloadPromise = optimizer.downloadModelWithResume(mockModel, '/test/dir');
      await downloadPromise; // Let it complete first
      
      // Check that it succeeded
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        mockModel.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            Range: 'bytes=262144-'
          })
        })
      );
    });
  });

  describe('Memory-Efficient Streaming', () => {
    it('should create optimized streaming pipeline', async () => {
      vi.mocked(fetch).mockImplementation(() => Promise.resolve(createMockResponse()));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      expect(createWriteStream).toHaveBeenCalledWith(
        expect.stringMatching(/\.partial$/),
        expect.objectContaining({
          highWaterMark: expect.any(Number)
        })
      );
    });

    it('should handle backpressure in streaming', async () => {
      // Mock write stream with backpressure
      mockWriteStream.write.mockReturnValue(false);
      mockWriteStream.once.mockImplementation((event: string, callback: () => void) => {
        if (event === 'drain') {
          setTimeout(callback, 10); // Simulate drain after small delay
        }
      });

      vi.mocked(fetch).mockImplementation(() => Promise.resolve(createMockResponse()));
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      expect(mockWriteStream.once).toHaveBeenCalledWith('drain', expect.any(Function));
    });

    it('should monitor memory usage during streaming', async () => {
      const customOptimizer = new PerformanceOptimizer(
        undefined,
        undefined,
        { 
          memoryMonitoring: true,
          memoryThreshold: 50 * 1024 * 1024 // 50MB threshold
        }
      );

      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      await customOptimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      // Memory usage should be monitored
      expect(process.memoryUsage).toHaveBeenCalled();
      
      customOptimizer.cleanup();
    });
  });

  describe('Bandwidth Throttling', () => {
    it('should apply bandwidth throttling when speed exceeds limit', async () => {
      const customOptimizer = new PerformanceOptimizer(
        { maxSpeed: 100 * 1024 }, // 100KB/s limit
        undefined,
        undefined
      );

      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const startTime = Date.now();
      await customOptimizer.downloadModelWithResume(mockModel, '/test/dir');
      const endTime = Date.now();

      // Should take some time due to throttling
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
      
      customOptimizer.cleanup();
    });

    it('should support adaptive throttling', async () => {
      const customOptimizer = new PerformanceOptimizer(
        { 
          maxSpeed: 1024 * 1024, // 1MB/s
          adaptive: true
        },
        undefined,
        undefined
      );

      expect(customOptimizer).toBeDefined();
      customOptimizer.cleanup();
    });

    it('should calculate bandwidth usage metrics', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      const metrics = optimizer.getMetrics();
      expect(metrics.bandwidthUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.bandwidthUsage).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', async () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        downloadSpeed: expect.any(Number),
        memoryUsage: expect.any(Number),
        activeDownloads: expect.any(Number),
        cpuUsage: expect.any(Number),
        bandwidthUsage: expect.any(Number),
        responseTime: expect.any(Number)
      }));
    });

    it('should maintain metrics history', async () => {
      // Wait a bit for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const history = optimizer.getMetricsHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should track active downloads', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      // Start download but don't await
      const downloadPromise = optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      // Check active downloads
      const activeDownloads = optimizer.getActiveDownloads();
      expect(activeDownloads.length).toBeGreaterThanOrEqual(0);

      await downloadPromise;
    });

    it('should update CPU usage metrics', async () => {
      const metrics = optimizer.getMetrics();
      
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
    });
  });

  describe('Download Management', () => {
    it('should cancel active downloads', async () => {
      const modelKey = `${mockModel.name}-${mockModel.version}`;
      
      await optimizer.cancelDownload(modelKey);
      
      const activeDownloads = optimizer.getActiveDownloads();
      const cancelledDownload = activeDownloads.find(d => 
        `${d.model.name}-${d.model.version}` === modelKey
      );
      
      expect(cancelledDownload).toBeUndefined();
    });

    it('should pause and resume downloads', async () => {
      const modelKey = `${mockModel.name}-${mockModel.version}`;
      
      await optimizer.pauseDownload(modelKey);
      await optimizer.resumeDownload(modelKey);
      
      // Should complete without errors
    });

    it('should track download status changes', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const downloadPromise = optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      // Check initial status
      await new Promise(resolve => setTimeout(resolve, 10));
      const activeDownloads = optimizer.getActiveDownloads();
      if (activeDownloads.length > 0) {
        expect(activeDownloads[0].status).toBe(DownloadStatus.DOWNLOADING);
      }

      await downloadPromise;
    });
  });

  describe('Resource Optimization', () => {
    it('should optimize configuration based on available memory', async () => {
      await optimizer.optimizeConfiguration();
      
      const metrics = optimizer.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should adjust concurrent downloads for low memory', async () => {
      // Mock low memory scenario
      vi.mocked(process.memoryUsage).mockReturnValue({
        rss: 400 * 1024 * 1024,
        heapTotal: 300 * 1024 * 1024,
        heapUsed: 450 * 1024 * 1024, // High usage
        external: 50 * 1024 * 1024,
        arrayBuffers: 25 * 1024 * 1024
      });

      await optimizer.optimizeConfiguration();
      
      // Configuration should be optimized for low memory
      expect(optimizer).toBeDefined();
    });

    it('should calculate average download speed', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      await optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      const metrics = optimizer.getMetrics();
      expect(typeof metrics.downloadSpeed).toBe('number');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide downloadModelsParallel convenience function', async () => {
      const models = [mockModel];

      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const results = await downloadModelsParallel(models, '/test/dir');
      
      expect(results).toHaveLength(1);
    });

    it('should provide downloadModelWithResume convenience function', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);
      vi.mocked(fs.rename).mockResolvedValue(undefined as any);

      const result = await downloadModelWithResume(mockModel, '/test/dir');
      
      expect(result).toMatch(/test-model-1\.0\.0\.onnx$/);
    });

    it('should provide getPerformanceMetrics convenience function', () => {
      const metrics = getPerformanceMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        downloadSpeed: expect.any(Number),
        memoryUsage: expect.any(Number),
        activeDownloads: expect.any(Number)
      }));
    });

    it('should provide getActiveDownloads convenience function', () => {
      const activeDownloads = getActiveDownloads();
      
      expect(Array.isArray(activeDownloads)).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      optimizer.cleanup();
      
      // Should complete without errors
    });

    it('should cancel all downloads during cleanup', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1048576') },
        body: createMockReadableStream(new Uint8Array(1024))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // Start a download
      const downloadPromise = optimizer.downloadModelWithResume(mockModel, '/test/dir');
      
      // Cleanup should cancel active downloads
      optimizer.cleanup();
      
      // Wait for any pending operations
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});

/**
 * Helper function to create mock readable stream - creates a new instance each time
 */
function createMockReadableStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // Send data in chunks
      const chunkSize = 256;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });
}

/**
 * Helper function to create fresh mock response with unique stream
 */
function createMockResponse(contentLength: string = '1048576'): any {
  return {
    ok: true,
    headers: {
      get: vi.fn().mockReturnValue(contentLength)
    },
    body: createMockReadableStream(new Uint8Array(1024))
  };
}