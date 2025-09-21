import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GCScheduler } from '../../../memory/gc-scheduler.js';
import type { MemorySnapshot, GCResult } from '../../../memory/types.js';

describe('GCScheduler', () => {
  let scheduler: GCScheduler;
  let mockGC: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock global.gc
    mockGC = vi.fn();
    (global as any).gc = mockGC;

    // Mock process.memoryUsage
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      heapUsed: 60 * 1024 * 1024, // 60MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024 // 5MB
    });

    scheduler = new GCScheduler({
      enabled: true,
      minInterval: 100, // 100ms for faster tests
      maxInterval: 1000, // 1s for faster tests
      pressureThreshold: 0.7,
      adaptiveScheduling: true,
      growthRateThreshold: 5,
      aggressiveMode: true
    });
  });

  afterEach(async () => {
    await scheduler.stop();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultScheduler = new GCScheduler();
      expect(defaultScheduler).toBeInstanceOf(GCScheduler);
    });

    it('should initialize with custom configuration', () => {
      const customScheduler = new GCScheduler({
        enabled: false,
        minInterval: 5000,
        maxInterval: 30000
      });
      expect(customScheduler).toBeInstanceOf(GCScheduler);
    });

    it('should start and stop successfully', async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();

      scheduler.on('started', startSpy);
      scheduler.on('stopped', stopSpy);

      await scheduler.start();
      expect(startSpy).toHaveBeenCalled();

      await scheduler.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('garbage collection', () => {
    it('should force GC and return result', async () => {
      const beforeMemory = {
        heapUsed: 100 * 1024 * 1024 // 100MB
      };
      const afterMemory = {
        heapUsed: 80 * 1024 * 1024 // 80MB
      };

      vi.spyOn(process, 'memoryUsage')
        .mockReturnValueOnce(beforeMemory as any)
        .mockReturnValueOnce(afterMemory as any);

      const result = await scheduler.forceGC('test');

      expect(mockGC).toHaveBeenCalled();
      expect(result).toMatchObject({
        duration: expect.any(Number),
        beforeMemory: beforeMemory.heapUsed,
        afterMemory: afterMemory.heapUsed,
        memoryCleaned: beforeMemory.heapUsed - afterMemory.heapUsed,
        timestamp: expect.any(Date)
      });
    });

    it('should throw error when GC is not exposed', async () => {
      delete (global as any).gc;

      await expect(scheduler.forceGC()).rejects.toThrow(
        'Garbage collection is not exposed. Run with --expose-gc flag.'
      );
    });

    it('should emit gc-completed event', async () => {
      const gcCompletedSpy = vi.fn();
      scheduler.on('gc-completed', gcCompletedSpy);

      await scheduler.forceGC('test-reason');

      expect(gcCompletedSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'test-reason'
      );
    });

    it('should update GC statistics', async () => {
      await scheduler.forceGC();
      await scheduler.forceGC();

      const stats = scheduler.getStats();
      expect(stats.totalGCs).toBe(2);
      expect(stats.totalTimeMS).toBeGreaterThanOrEqual(0);
      expect(stats.averageGCTime).toBeGreaterThanOrEqual(0);
      expect(stats.lastGC).toBeInstanceOf(Date);
    });
  });

  describe('memory pressure analysis', () => {
    it('should analyze memory pressure correctly', () => {
      const memorySnapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: 60 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        heapUtilization: 0.75
      };

      const pressure = scheduler.analyzeMemoryPressure(memorySnapshot);

      expect(pressure).toMatchObject({
        level: expect.stringMatching(/^(low|medium|high|critical)$/),
        score: expect.any(Number),
        factors: {
          heapUtilization: expect.any(Number),
          growthRate: expect.any(Number),
          gcEffectiveness: expect.any(Number),
          availableMemory: expect.any(Number)
        },
        recommendation: expect.stringMatching(/^(none|schedule|immediate|aggressive)$/)
      });

      expect(pressure.score).toBeGreaterThanOrEqual(0);
      expect(pressure.score).toBeLessThanOrEqual(1);
    });

    it('should detect low memory pressure', () => {
      const memorySnapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: 20 * 1024 * 1024, // Low usage
        heapTotal: 100 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 50 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        heapUtilization: 0.2
      };

      const pressure = scheduler.analyzeMemoryPressure(memorySnapshot);
      expect(pressure.level).toBe('low');
      expect(pressure.recommendation).toBe('none');
    });

    it('should detect high memory pressure', () => {
      const memorySnapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: 380 * 1024 * 1024, // High usage
        heapTotal: 400 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        rss: 500 * 1024 * 1024,
        arrayBuffers: 20 * 1024 * 1024,
        heapUtilization: 0.95
      };

      const pressure = scheduler.analyzeMemoryPressure(memorySnapshot);
      expect(['high', 'critical']).toContain(pressure.level);
      expect(['immediate', 'aggressive']).toContain(pressure.recommendation);
    });
  });

  describe('scheduling', () => {
    it('should create appropriate schedule for different pressure levels', () => {
      const lowPressure = {
        level: 'low' as const,
        score: 0.2,
        factors: {
          heapUtilization: 0.2,
          growthRate: 0.1,
          gcEffectiveness: 0.8,
          availableMemory: 0.8
        },
        recommendation: 'none' as const
      };

      const schedule = scheduler.createSchedule(lowPressure);
      expect(schedule.priority).toBe('low');
      expect(schedule.nextGC).toBeInstanceOf(Date);
    });

    it('should create urgent schedule for high pressure', () => {
      const highPressure = {
        level: 'critical' as const,
        score: 0.9,
        factors: {
          heapUtilization: 0.95,
          growthRate: 0.8,
          gcEffectiveness: 0.3,
          availableMemory: 0.1
        },
        recommendation: 'aggressive' as const
      };

      const schedule = scheduler.createSchedule(highPressure);
      expect(schedule.priority).toBe('critical');
      expect(schedule.mode).toBe('aggressive');
    });

    it('should respect minimum interval between GCs', () => {
      const pressure = {
        level: 'critical' as const,
        score: 0.9,
        factors: {
          heapUtilization: 0.95,
          growthRate: 0.8,
          gcEffectiveness: 0.3,
          availableMemory: 0.1
        },
        recommendation: 'immediate' as const
      };

      // Simulate recent GC
      scheduler['lastGCTime'] = Date.now() - 50; // 50ms ago

      const schedule = scheduler.createSchedule(pressure);
      const delay = schedule.nextGC.getTime() - Date.now();
      
      expect(delay).toBeGreaterThanOrEqual(50); // At least remaining minimum interval
    });
  });

  describe('memory history tracking', () => {
    it('should update memory history', () => {
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: 60 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        heapUtilization: 0.75
      };

      scheduler.updateMemoryHistory(snapshot);
      
      // Access private property for testing
      const history = (scheduler as any).memoryHistory;
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(snapshot);
    });

    it('should limit history size', () => {
      const maxSize = (scheduler as any).maxHistorySize;
      
      // Add more than max size
      for (let i = 0; i < maxSize + 10; i++) {
        const snapshot: MemorySnapshot = {
          timestamp: Date.now() + i,
          heapUsed: 60 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          rss: 100 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
          heapUtilization: 0.75
        };
        scheduler.updateMemoryHistory(snapshot);
      }

      const history = (scheduler as any).memoryHistory;
      expect(history).toHaveLength(maxSize);
    });
  });

  describe('pressure history', () => {
    it('should track pressure history', () => {
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        heapUsed: 60 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        heapUtilization: 0.75
      };

      scheduler.analyzeMemoryPressure(snapshot);
      
      const history = scheduler.getPressureHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        level: expect.any(String),
        score: expect.any(Number),
        factors: expect.any(Object),
        recommendation: expect.any(String)
      });
    });
  });

  describe('adaptive scheduling', () => {
    it('should calculate growth rate from history', () => {
      // Add some memory history
      const baseTime = Date.now();
      for (let i = 0; i < 5; i++) {
        scheduler.updateMemoryHistory({
          timestamp: baseTime + i * 1000,
          heapUsed: (50 + i * 10) * 1024 * 1024, // Growing memory
          heapTotal: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          rss: 100 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
          heapUtilization: (50 + i * 10) / 100
        });
      }

      const growthRate = (scheduler as any).calculateGrowthRate();
      expect(growthRate).toBeGreaterThan(0);
    });

    it('should return zero growth rate with insufficient history', () => {
      const growthRate = (scheduler as any).calculateGrowthRate();
      expect(growthRate).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle scheduling errors gracefully', async () => {
      const errorSpy = vi.fn();
      scheduler.on('error', errorSpy);

      // Mock process.memoryUsage to throw an error
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory access failed');
      });

      await scheduler.start();

      // Allow some time for the error to occur
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle GC execution errors', async () => {
      const errorSpy = vi.fn();
      scheduler.on('error', errorSpy);

      // Make global.gc throw an error
      mockGC.mockImplementation(() => {
        throw new Error('GC failed');
      });

      await expect(scheduler.forceGC()).rejects.toThrow('GC failed');
    });
  });

  describe('configuration', () => {
    it('should skip scheduling when disabled', async () => {
      const disabledScheduler = new GCScheduler({ enabled: false });
      const infoSpy = vi.fn();
      disabledScheduler.on('info', infoSpy);

      await disabledScheduler.start();
      expect(infoSpy).toHaveBeenCalledWith('GC scheduler is disabled');
    });

    it('should use custom intervals', () => {
      const customScheduler = new GCScheduler({
        minInterval: 1000,
        maxInterval: 10000
      });

      const config = (customScheduler as any).config;
      expect(config.minInterval).toBe(1000);
      expect(config.maxInterval).toBe(10000);
    });
  });

  describe('event emission', () => {
    it('should emit pressure-analysis event', async () => {
      const pressureAnalysisSpy = vi.fn();
      scheduler.on('pressure-analysis', pressureAnalysisSpy);

      await scheduler.start();

      // Allow time for analysis
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(pressureAnalysisSpy).toHaveBeenCalled();
    });

    it('should emit scheduled-gc event', async () => {
      const scheduledGcSpy = vi.fn();
      scheduler.on('scheduled-gc', scheduledGcSpy);

      // Create high pressure scenario
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 3.8 * 1024 * 1024 * 1024, // 3.8GB - high usage
        heapTotal: 1.5 * 1024 * 1024 * 1024, // 1.5GB
        heapUsed: 1.4 * 1024 * 1024 * 1024, // 1.4GB - high usage
        external: 100 * 1024 * 1024,
        arrayBuffers: 50 * 1024 * 1024
      });

      await scheduler.start();

      // Allow time for high-priority GC to trigger
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(scheduledGcSpy).toHaveBeenCalled();
    });
  });
});