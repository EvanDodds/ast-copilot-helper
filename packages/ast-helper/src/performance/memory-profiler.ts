import { MemoryMonitor, PerformanceTimer, CPUMonitor } from './utils';
import { PerformanceObserver } from 'perf_hooks';
import type { NodeCount, MemoryProfile, PhaseMemoryProfile, MemoryLeak, GCMetrics } from './types';

/**
 * Memory profiling and analysis for performance testing.
 * Provides comprehensive memory usage tracking, leak detection, and optimization recommendations.
 */
export class MemoryProfiler {
  private memoryMonitor: MemoryMonitor;
  private timer: PerformanceTimer;
  private cpuMonitor: CPUMonitor;
  private gcEvents: GCMetrics[] = [];

  constructor() {
    this.memoryMonitor = new MemoryMonitor();
    this.timer = new PerformanceTimer();
    this.cpuMonitor = new CPUMonitor();
    this.setupGCMonitoring();
  }

  /**
   * Run comprehensive memory profiling
   */
  async runMemoryProfiling(config: MemoryProfilingConfig): Promise<MemoryProfile> {
    console.log('🧠 Starting comprehensive memory profiling...');
    
    try {
      const phases: PhaseMemoryProfile[] = [];
      let peakUsage = 0;
      let totalMemory = 0;
      let measurements = 0;
      
      // Test different workload sizes
      for (const nodeCount of config.nodeCounts) {
        console.log(`Testing memory usage with ${nodeCount} nodes...`);
        const phaseProfile = await this.profilePhase(`workload_${nodeCount}`, nodeCount, config);
        phases.push(phaseProfile);
        
        peakUsage = Math.max(peakUsage, phaseProfile.peakMemory);
        totalMemory += phaseProfile.avgMemory;
        measurements++;
      }

      const memoryLeaks = this.detectMemoryLeaks(phases);
      const averageUsage = measurements > 0 ? totalMemory / measurements : 0;

      return {
        phases,
        peakUsage: peakUsage / (1024 * 1024), // Convert to MB
        averageUsage: averageUsage / (1024 * 1024), // Convert to MB
        memoryLeaks,
        gcPerformance: [...this.gcEvents]
      };
    } catch (error) {
      console.error('❌ Memory profiling failed:', error);
      throw error;
    }
  }

  /**
   * Profile a specific phase/workload
   */
  private async profilePhase(phaseName: string, nodeCount: NodeCount, config: MemoryProfilingConfig): Promise<PhaseMemoryProfile> {
    // Start monitoring
    this.memoryMonitor.start();
    this.cpuMonitor.startMonitoring();
    this.timer.start(phaseName);
    
    const startMemory = process.memoryUsage().heapUsed;
    let peakMemory = startMemory;
    let totalMemory = 0;
    let sampleCount = 0;
    
    try {
      // Monitor memory during workload
      const monitoringInterval = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        peakMemory = Math.max(peakMemory, currentMemory);
        totalMemory += currentMemory;
        sampleCount++;
      }, 10); // Sample every 10ms
      
      // Run the workload
      await this.simulateWorkload(this.getNodeCountAsNumber(nodeCount), config);
      
      clearInterval(monitoringInterval);
      
      // Final measurements
      const endMemory = process.memoryUsage().heapUsed;
      const avgMemory = sampleCount > 0 ? totalMemory / sampleCount : startMemory;
      const duration = this.timer.end(phaseName);
      
      this.memoryMonitor.stop();
      this.cpuMonitor.stopMonitoring();
      
      return {
        phase: phaseName,
        startMemory,
        peakMemory,
        endMemory,
        avgMemory,
        duration
      };
      
    } catch (error) {
      this.memoryMonitor.stop();
      this.cpuMonitor.stopMonitoring();
      this.timer.end(phaseName);
      throw error;
    }
  }

  /**
   * Simulate workload for memory testing
   */
  private async simulateWorkload(nodeCount: number, config: MemoryProfilingConfig): Promise<void> {
    switch (config.workloadType) {
      case 'parsing':
        await this.simulateParsingWorkload(nodeCount);
        break;
      case 'querying':
        await this.simulateQueryingWorkload(nodeCount);
        break;
      case 'indexing':
        await this.simulateIndexingWorkload(nodeCount);
        break;
      case 'mixed':
        await this.simulateMixedWorkload(nodeCount);
        break;
      default:
        throw new Error(`Unknown workload type: ${config.workloadType}`);
    }
  }

  /**
   * Simulate parsing workload
   */
  private async simulateParsingWorkload(nodeCount: number): Promise<void> {
    // Create test data structures that simulate AST parsing
    const nodes = [];
    
    for (let i = 0; i < nodeCount; i++) {
      // Simulate AST node creation
      const node = {
        id: `node_${i}`,
        type: 'identifier',
        value: `variable_${i}`,
        position: { line: i % 1000 + 1, column: i % 100 + 1 },
        children: [],
        parent: null,
        metadata: {
          sourceFile: `file_${Math.floor(i / 100)}.ts`,
          semanticInfo: {
            scope: 'local',
            type: 'string',
            references: []
          }
        }
      };
      
      nodes.push(node);
      
      // Simulate some processing
      if (i % 1000 === 0) {
        await this.sleep(1); // Yield occasionally
      }
    }
    
    // Simulate AST traversal
    for (const node of nodes) {
      (node.metadata as any).processed = true;
    }
  }

  /**
   * Simulate querying workload
   */
  private async simulateQueryingWorkload(nodeCount: number): Promise<void> {
    // Create data structures that simulate query caches and results
    const queryCache = new Map();
    const results = [];
    
    const numQueries = Math.min(nodeCount / 10, 1000);
    
    for (let i = 0; i < numQueries; i++) {
      const query = `query_${i}`;
      const queryResult = {
        id: `result_${i}`,
        matches: Array.from({ length: Math.floor(Math.random() * 50) + 1 }, (_, j) => ({
          file: `file_${j}.ts`,
          line: j + 1,
          column: 1,
          text: `match_${j}`,
          score: Math.random()
        })),
        metadata: {
          duration: Math.random() * 100,
          cached: false
        }
      };
      
      queryCache.set(query, queryResult);
      results.push(queryResult);
      
      if (i % 100 === 0) {
        await this.sleep(1);
      }
    }
  }

  /**
   * Simulate indexing workload
   */
  private async simulateIndexingWorkload(nodeCount: number): Promise<void> {
    // Create data structures that simulate indexing
    const index = new Map();
    const embeddings = [];
    
    for (let i = 0; i < nodeCount; i++) {
      // Simulate embedding generation
      const embedding = new Float32Array(384); // Typical embedding size
      for (let j = 0; j < embedding.length; j++) {
        embedding[j] = Math.random() * 2 - 1;
      }
      
      const indexEntry = {
        id: `entry_${i}`,
        text: `This is sample text for entry ${i}`,
        embedding,
        metadata: {
          file: `file_${Math.floor(i / 100)}.ts`,
          line: i % 1000 + 1,
          type: 'function'
        }
      };
      
      index.set(`entry_${i}`, indexEntry);
      embeddings.push(embedding);
      
      if (i % 500 === 0) {
        await this.sleep(1);
      }
    }
  }

  /**
   * Simulate mixed workload
   */
  private async simulateMixedWorkload(nodeCount: number): Promise<void> {
    const parsingNodes = Math.floor(nodeCount * 0.4);
    const queryNodes = Math.floor(nodeCount * 0.3);
    const indexingNodes = Math.floor(nodeCount * 0.3);
    
    await Promise.all([
      this.simulateParsingWorkload(parsingNodes),
      this.simulateQueryingWorkload(queryNodes),
      this.simulateIndexingWorkload(indexingNodes)
    ]);
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    try {
      const obs = new PerformanceObserver((list: any) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc') {
            this.gcEvents.push({
              timestamp: Date.now(),
              gcType: entry.detail?.kind || 'unknown',
              duration: entry.duration,
              memoryFreed: 0 // Will be calculated if needed
            });
          }
        }
      });
      
      obs.observe({ entryTypes: ['gc'] });
    } catch (error: unknown) {
      // GC monitoring not available in this environment
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('GC monitoring not available:', errorMessage);
    }
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(phases: PhaseMemoryProfile[]): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (!phase) {
continue;
}
      
      const retentionRate = (phase.endMemory - phase.startMemory) / (phase.peakMemory - phase.startMemory || 1);
      
      // High retention rate indicates potential leaks
      if (retentionRate > 0.7) {
        const severity: 'low' | 'medium' | 'high' = retentionRate > 0.9 ? 'high' : retentionRate > 0.8 ? 'medium' : 'low';
        
        leaks.push({
          location: phase.phase,
          severity,
          leakRate: (phase.endMemory - phase.startMemory) / phase.duration / 1000, // MB/s
          description: `High memory retention (${(retentionRate * 100).toFixed(1)}%) detected in phase ${phase.phase}`
        });
      }
    }
    
    return leaks;
  }

  /**
   * Convert NodeCount to number
   */
  private getNodeCountAsNumber(nodeCount: NodeCount): number {
    if (typeof nodeCount === 'number') {
return nodeCount;
}
    
    const mapping = {
      'small': 1000,
      'medium': 10000,
      'large': 50000,
      'xlarge': 100000
    };
    
    return mapping[nodeCount] || 1000;
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Memory profiling configuration
 */
export interface MemoryProfilingConfig {
  nodeCounts: NodeCount[];
  workloadType: 'parsing' | 'querying' | 'indexing' | 'mixed';
  iterations: number;
  timeout?: number;
}