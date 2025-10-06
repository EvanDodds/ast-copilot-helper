/**
 * Batch Processor - Advanced Batch Processing System
 * Part of Issue #150 - Performance Optimization Component
 */

import type {
  ProcessingMetrics,
  ProcessingOptimizationConfig,
  BatchJob,
  BatchJobResult,
  PerformanceAlert,
} from "./types.js";
import { BatchJobStatus, AlertType, AlertSeverity } from "./types.js";
import { createLogger } from "../../logging/index.js";

/**
 * Priority queue for batch jobs
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const queueItem = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      const existingItem = this.items[i];
      if (existingItem && queueItem.priority > existingItem.priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  get length(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * Circuit breaker for handling failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private failureThreshold: number,
    private recoveryTimeout: number,
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "open";
    }
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Advanced Batch Processor with optimizations and monitoring
 */
export class BatchProcessor<T, R = unknown> {
  private logger = createLogger({ operation: "batch-processor" });
  private config: ProcessingOptimizationConfig;
  private queue: PriorityQueue<BatchJob<T>>;
  private activeJobs = new Map<string, BatchJob<T>>();
  private completedJobs = new Map<string, BatchJob<T>>();
  private metrics: ProcessingMetrics;
  private workers: Array<{ id: string; busy: boolean; lastActivity: number }> =
    [];
  private circuitBreaker: CircuitBreaker;
  private processingTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private alerts: PerformanceAlert[] = [];
  private isShutdown = false;

  constructor(
    config: ProcessingOptimizationConfig,
    private processor: (item: T) => Promise<R>,
  ) {
    this.config = config;
    this.queue = new PriorityQueue<BatchJob<T>>();
    this.metrics = this.initializeMetrics();
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.recoveryTimeout,
    );

    this.initializeWorkers();
    this.startProcessing();
    this.startMonitoring();

    this.logger.info("Batch Processor initialized", {
      maxConcurrency: config.maxConcurrency,
      batchSize: config.batchSize,
      queueMaxSize: config.queueMaxSize,
    });
  }

  /**
   * Initialize processing metrics
   */
  private initializeMetrics(): ProcessingMetrics {
    return {
      throughput: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      queueSize: 0,
      activeWorkers: 0,
      completedTasks: 0,
      failedTasks: 0,
    };
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.config.maxConcurrency; i++) {
      this.workers.push({
        id: `worker-${i}`,
        busy: false,
        lastActivity: Date.now(),
      });
    }
  }

  /**
   * Submit batch job for processing
   */
  public async submitJob(
    items: T[],
    options: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
    } = {},
  ): Promise<string> {
    if (this.isShutdown) {
      throw new Error("Batch processor is shutdown");
    }

    if (this.queue.length >= this.config.queueMaxSize) {
      throw new Error("Queue is full");
    }

    const job: BatchJob<T> = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items,
      priority: options.priority ?? 0,
      timeout: options.timeout ?? this.config.processingTimeout,
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.retryAttempts,
      createdAt: Date.now(),
      status: BatchJobStatus.PENDING,
    };

    this.queue.enqueue(job, job.priority);
    this.metrics.queueSize = this.queue.length;

    this.logger.debug("Job submitted", {
      jobId: job.id,
      itemCount: items.length,
      priority: job.priority,
      queueSize: this.queue.length,
    });

    return job.id;
  }

  /**
   * Get job status
   */
  public getJobStatus(jobId: string): BatchJob<T> | undefined {
    return this.activeJobs.get(jobId) ?? this.completedJobs.get(jobId);
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (!this.config.enabled) {
      return;
    }

    this.processingTimer = setInterval(async () => {
      await this.processQueue();
    }, 100); // Check queue every 100ms
  }

  /**
   * Process queue with available workers
   */
  private async processQueue(): Promise<void> {
    const availableWorkers = this.workers.filter((w) => !w.busy);

    for (const worker of availableWorkers) {
      if (this.queue.isEmpty()) {
        break;
      }

      const job = this.queue.dequeue();
      if (!job) {
        continue;
      }

      this.processJob(job, worker);
    }

    this.metrics.queueSize = this.queue.length;
    this.metrics.activeWorkers = this.workers.filter((w) => w.busy).length;
  }

  /**
   * Process individual job
   */
  private async processJob(
    job: BatchJob<T>,
    worker: { id: string; busy: boolean; lastActivity: number },
  ): Promise<void> {
    worker.busy = true;
    worker.lastActivity = Date.now();

    job.status = BatchJobStatus.RUNNING;
    job.startedAt = Date.now();
    this.activeJobs.set(job.id, job);

    this.logger.debug("Job processing started", {
      jobId: job.id,
      workerId: worker.id,
      itemCount: job.items.length,
    });

    try {
      const results = await this.processJobItems(job);

      job.results = results;
      job.status = BatchJobStatus.COMPLETED;
      job.completedAt = Date.now();

      this.metrics.completedTasks += job.items.length;

      this.logger.info("Job completed successfully", {
        jobId: job.id,
        workerId: worker.id,
        processingTime: job.completedAt - (job.startedAt ?? job.createdAt),
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
      });
    } catch (error) {
      await this.handleJobFailure(job, error);
    } finally {
      worker.busy = false;
      worker.lastActivity = Date.now();

      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);

      // Cleanup old completed jobs
      this.cleanupCompletedJobs();
    }
  }

  /**
   * Process job items in batches
   */
  private async processJobItems(
    job: BatchJob<T>,
  ): Promise<BatchJobResult<T, R>[]> {
    const results: BatchJobResult<T, R>[] = [];
    const batchSize = Math.min(this.config.batchSize, job.items.length);

    for (let i = 0; i < job.items.length; i += batchSize) {
      const batch = job.items.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, job.timeout);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a batch of items
   */
  private async processBatch(
    items: T[],
    timeout: number,
  ): Promise<BatchJobResult<T, R>[]> {
    const batchPromises = items.map(
      async (item): Promise<BatchJobResult<T, R>> => {
        const startTime = Date.now();

        try {
          const result = await this.circuitBreaker.execute(async () => {
            return Promise.race([
              this.processor(item),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Processing timeout")),
                  timeout,
                ),
              ),
            ]);
          });

          return {
            item,
            success: true,
            result,
            processingTime: Date.now() - startTime,
          };
        } catch (error) {
          this.metrics.failedTasks++;
          return {
            item,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            processingTime: Date.now() - startTime,
          };
        }
      },
    );

    return Promise.all(batchPromises);
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(
    job: BatchJob<T>,
    error: unknown,
  ): Promise<void> {
    job.error = error instanceof Error ? error : new Error(String(error));
    job.retryCount++;

    this.logger.warn("Job processing failed", {
      jobId: job.id,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      error: job.error.message,
    });

    if (job.retryCount < job.maxRetries) {
      // Retry with exponential backoff
      const delay = this.config.retryDelay * Math.pow(2, job.retryCount - 1);

      setTimeout(() => {
        job.status = BatchJobStatus.PENDING;
        this.queue.enqueue(job, job.priority);
      }, delay);

      this.logger.info("Job queued for retry", {
        jobId: job.id,
        retryDelay: delay,
        retryCount: job.retryCount,
      });
    } else {
      job.status = BatchJobStatus.FAILED;
      job.completedAt = Date.now();
      this.metrics.failedTasks += job.items.length;

      this.logger.error("Job failed permanently", {
        jobId: job.id,
        finalError: job.error.message,
      });
    }
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.updateMetrics();
      this.checkPerformanceThresholds();
    }, 5000); // Monitor every 5 seconds
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const completed = Array.from(this.completedJobs.values());
    const recent = completed.filter(
      (job) => job.completedAt && Date.now() - job.completedAt < 60000, // Last minute
    );

    if (recent.length > 0) {
      const processingTimes = recent
        .filter((job) => job.startedAt && job.completedAt)
        .map(
          (job) => (job.completedAt ?? 0) - (job.startedAt ?? job.createdAt),
        );

      if (processingTimes.length > 0) {
        this.metrics.averageLatency =
          processingTimes.reduce((sum, time) => sum + time, 0) /
          processingTimes.length;
        this.metrics.p95Latency = this.calculatePercentile(
          processingTimes,
          0.95,
        );
        this.metrics.p99Latency = this.calculatePercentile(
          processingTimes,
          0.99,
        );
      }

      const totalItems = recent.reduce((sum, job) => sum + job.items.length, 0);
      this.metrics.throughput = totalItems / 60; // Items per second over last minute
    }
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkPerformanceThresholds(): void {
    // High queue size alert
    if (this.metrics.queueSize > this.config.queueMaxSize * 0.8) {
      this.generateAlert({
        type: AlertType.QUEUE_FULL,
        severity: AlertSeverity.WARNING,
        metric: "queue_size",
        currentValue: this.metrics.queueSize,
        threshold: this.config.queueMaxSize * 0.8,
        message: `High queue size: ${this.metrics.queueSize}`,
        recommendations: [
          "Increase worker concurrency",
          "Optimize processing logic",
          "Reduce batch sizes",
          "Add more processing capacity",
        ],
      });
    }

    // High latency alert
    if (this.metrics.averageLatency > 10000) {
      // 10 seconds
      this.generateAlert({
        type: AlertType.LATENCY_HIGH,
        severity: AlertSeverity.WARNING,
        metric: "average_latency",
        currentValue: this.metrics.averageLatency,
        threshold: 10000,
        message: `High processing latency: ${this.metrics.averageLatency}ms`,
        recommendations: [
          "Optimize processing logic",
          "Reduce batch sizes",
          "Check for bottlenecks",
          "Increase timeout values",
        ],
      });
    }

    // High error rate alert
    const totalTasks = this.metrics.completedTasks + this.metrics.failedTasks;
    const errorRate =
      totalTasks > 0 ? this.metrics.failedTasks / totalTasks : 0;

    if (errorRate > 0.1) {
      // 10% error rate
      this.generateAlert({
        type: AlertType.ERROR_RATE_HIGH,
        severity: AlertSeverity.ERROR,
        metric: "error_rate",
        currentValue: errorRate,
        threshold: 0.1,
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        recommendations: [
          "Review error patterns",
          "Improve error handling",
          "Check input validation",
          "Monitor external dependencies",
        ],
      });
    }
  }

  /**
   * Generate performance alert
   */
  private generateAlert(
    alertData: Omit<PerformanceAlert, "id" | "timestamp" | "resolved">,
  ): void {
    const alert: PerformanceAlert = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);
    this.logger.warn("Batch processing alert generated", alert);
  }

  /**
   * Cleanup old completed jobs
   */
  private cleanupCompletedJobs(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const jobsToDelete: string[] = [];

    for (const [jobId, job] of this.completedJobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        jobsToDelete.push(jobId);
      }
    }

    for (const jobId of jobsToDelete) {
      this.completedJobs.delete(jobId);
    }
  }

  /**
   * Get processing metrics
   */
  public getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    metrics: ProcessingMetrics;
    alerts: PerformanceAlert[];
    queueSize: number;
    activeJobs: number;
    completedJobs: number;
    circuitBreakerState: string;
    workerUtilization: number;
  } {
    const busyWorkers = this.workers.filter((w) => w.busy).length;
    const workerUtilization =
      this.workers.length > 0 ? busyWorkers / this.workers.length : 0;

    return {
      metrics: this.getMetrics(),
      alerts: [...this.alerts],
      queueSize: this.queue.length,
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      workerUtilization,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProcessingOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("Batch processor configuration updated", config);
  }

  /**
   * Shutdown batch processor
   */
  public async shutdown(): Promise<void> {
    this.isShutdown = true;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Wait for active jobs to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (
      this.activeJobs.size > 0 &&
      Date.now() - startTime < shutdownTimeout
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.logger.info("Batch processor shutdown", {
      remainingActiveJobs: this.activeJobs.size,
      queueSize: this.queue.length,
    });
  }
}
