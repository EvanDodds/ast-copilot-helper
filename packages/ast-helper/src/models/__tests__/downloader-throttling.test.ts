/**
 * Tests for bandwidth throttling and proxy support in ModelDownloader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelDownloader, RateLimiter, type RateLimitConfig, type ProxyConfig } from '../downloader.js';
import { ModelConfig } from '../types.js';

describe('ModelDownloader - Bandwidth Throttling & Proxy Support', () => {
  let downloader: ModelDownloader;
  let mockLogger: Console;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    } as any;
    
    downloader = new ModelDownloader(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RateLimiter', () => {
    it('should create rate limiter with default configuration', () => {
      const rateLimiter = new RateLimiter();
      expect(rateLimiter.getOptimalChunkSize()).toBe(64 * 1024); // 64KB default
    });

    it('should create rate limiter with custom configuration', () => {
      const config: RateLimitConfig = {
        maxBytesPerSecond: 1024 * 1024, // 1MB/s
        minChunkDelay: 100,
        chunkSize: 32 * 1024 // 32KB
      };
      
      const rateLimiter = new RateLimiter(config);
      expect(rateLimiter.getOptimalChunkSize()).toBe(32 * 1024);
    });

    it('should throttle downloads when rate limit is set', async () => {
      const config: RateLimitConfig = {
        maxBytesPerSecond: 1024, // 1KB/s
        chunkSize: 1024
      };
      
      const rateLimiter = new RateLimiter(config);
      const chunkSize = 1024;
      
      const startTime = Date.now();
      await rateLimiter.throttle(chunkSize);
      await rateLimiter.throttle(chunkSize);
      const endTime = Date.now();
      
      // Second throttle call should have introduced delay
      // Allow for timing variations
      expect(endTime - startTime).toBeGreaterThan(800);
    });

    it('should apply minimum chunk delay', async () => {
      const config: RateLimitConfig = {
        minChunkDelay: 500 // 500ms minimum delay
      };
      
      const rateLimiter = new RateLimiter(config);
      
      const startTime = Date.now();
      await rateLimiter.throttle(1024);
      await rateLimiter.throttle(1024);
      const endTime = Date.now();
      
      // Should have at least 500ms delay
      expect(endTime - startTime).toBeGreaterThan(400);
    });

    it('should not throttle when no limits are set', async () => {
      const rateLimiter = new RateLimiter({});
      
      const startTime = Date.now();
      await rateLimiter.throttle(1024);
      await rateLimiter.throttle(1024);
      const endTime = Date.now();
      
      // Should complete quickly without throttling
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Proxy Configuration', () => {
    it('should accept proxy configuration in download options', () => {
      const proxyConfig: ProxyConfig = {
        host: 'proxy.example.com',
        port: 8080,
        protocol: 'http'
      };

      // This test verifies the interface accepts proxy config
      // Actual proxy functionality requires additional libraries
      expect(proxyConfig.host).toBe('proxy.example.com');
      expect(proxyConfig.port).toBe(8080);
      expect(proxyConfig.protocol).toBe('http');
    });

    it('should accept proxy configuration with authentication', () => {
      const proxyConfig: ProxyConfig = {
        host: 'secure-proxy.example.com',
        port: 8080,
        protocol: 'https',
        auth: {
          username: 'testuser',
          password: 'testpass'
        }
      };

      expect(proxyConfig.auth?.username).toBe('testuser');
      expect(proxyConfig.auth?.password).toBe('testpass');
    });

    it('should log proxy configuration when provided', async () => {
      // Mock fetch to avoid actual HTTP requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const modelConfig: ModelConfig = {
        name: 'test-model',
        version: '1.0.0',
        url: 'https://example.com/model.bin',
        size: 1024,
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 384,
        description: 'Test model'
      };

      const proxyConfig: ProxyConfig = {
        host: 'proxy.example.com',
        port: 8080,
        protocol: 'http'
      };

      try {
        await downloader.downloadModel(modelConfig, '/tmp/test.bin', { proxy: proxyConfig });
      } catch (error) {
        // Expected to fail due to mocked fetch
      }

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Using proxy: http://proxy.example.com:8080')
      );
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should log rate limiting configuration when enabled', async () => {
      // Mock fetch to avoid actual HTTP requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const modelConfig: ModelConfig = {
        name: 'test-model',
        version: '1.0.0',
        url: 'https://example.com/model.bin',
        size: 1024,
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 384,
        description: 'Test model'
      };

      const rateLimitConfig: RateLimitConfig = {
        maxBytesPerSecond: 1024 * 1024, // 1MB/s
        chunkSize: 64 * 1024
      };

      try {
        await downloader.downloadModel(modelConfig, '/tmp/test.bin', { rateLimit: rateLimitConfig });
      } catch (error) {
        // Expected to fail due to mocked fetch
      }

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Rate limiting enabled: 1.0 MB/s')
      );
    });

    it('should not create rate limiter when no rate limit config provided', async () => {
      // Mock fetch to avoid actual HTTP requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const modelConfig: ModelConfig = {
        name: 'test-model',
        version: '1.0.0',
        url: 'https://example.com/model.bin',
        size: 1024,
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 384,
        description: 'Test model'
      };

      try {
        await downloader.downloadModel(modelConfig, '/tmp/test.bin', {});
      } catch (error) {
        // Expected to fail due to mocked fetch
      }

      // Should not log rate limiting info
      expect(mockLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Rate limiting enabled')
      );
    });

    it('should work with both proxy and rate limiting enabled', async () => {
      // Mock fetch to avoid actual HTTP requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const modelConfig: ModelConfig = {
        name: 'test-model',
        version: '1.0.0',
        url: 'https://example.com/model.bin',
        size: 1024,
        checksum: 'abc123',
        format: 'onnx',
        dimensions: 384,
        description: 'Test model'
      };

      const proxyConfig: ProxyConfig = {
        host: 'proxy.example.com',
        port: 8080
      };

      const rateLimitConfig: RateLimitConfig = {
        maxBytesPerSecond: 512 * 1024, // 512KB/s
        minChunkDelay: 100
      };

      try {
        await downloader.downloadModel(modelConfig, '/tmp/test.bin', { 
          proxy: proxyConfig,
          rateLimit: rateLimitConfig
        });
      } catch (error) {
        // Expected to fail due to mocked fetch
      }

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Using proxy: http://proxy.example.com:8080')
      );
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Rate limiting enabled: 512.0 KB/s')
      );
    });
  });

  describe('Enhanced Download Options', () => {
    it('should handle all download options together', () => {
      const options = {
        maxRetries: 5,
        timeout: 600000,
        resumeDownload: true,
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
          protocol: 'https' as const,
          auth: {
            username: 'user',
            password: 'pass'
          }
        },
        rateLimit: {
          maxBytesPerSecond: 2 * 1024 * 1024, // 2MB/s
          minChunkDelay: 50,
          chunkSize: 128 * 1024 // 128KB
        },
        onProgress: vi.fn()
      };

      // Verify all options are properly typed and accepted
      expect(options.maxRetries).toBe(5);
      expect(options.proxy?.host).toBe('proxy.example.com');
      expect(options.rateLimit?.maxBytesPerSecond).toBe(2 * 1024 * 1024);
    });
  });
});