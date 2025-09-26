use crate::error::EngineError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Performance metrics for various operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Operation name or identifier
    pub operation: String,
    /// Duration in milliseconds
    pub duration_ms: u64,
    /// Memory usage in bytes
    pub memory_usage_bytes: u64,
    /// Number of operations completed
    pub operations_count: u64,
    /// Throughput (operations per second)
    pub throughput_ops_per_sec: f64,
    /// Error count
    pub error_count: u64,
    /// Success rate (0.0 to 1.0)
    pub success_rate: f64,
    /// Timestamp when metric was recorded
    pub timestamp: u64,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl PerformanceMetrics {
    pub fn new(operation: String) -> Self {
        Self {
            operation,
            duration_ms: 0,
            memory_usage_bytes: 0,
            operations_count: 0,
            throughput_ops_per_sec: 0.0,
            error_count: 0,
            success_rate: 1.0,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            metadata: HashMap::new(),
        }
    }

    /// Calculate throughput based on operations and duration
    pub fn calculate_throughput(&mut self) {
        if self.duration_ms > 0 {
            let duration_secs = self.duration_ms as f64 / 1000.0;
            self.throughput_ops_per_sec = self.operations_count as f64 / duration_secs;
        }
    }

    /// Calculate success rate based on operations and errors
    pub fn calculate_success_rate(&mut self) {
        if self.operations_count > 0 {
            let successful_ops = self.operations_count - self.error_count;
            self.success_rate = successful_ops as f64 / self.operations_count as f64;
        }
    }

    /// Add metadata entry
    pub fn add_metadata<K: Into<String>, V: Into<String>>(&mut self, key: K, value: V) {
        self.metadata.insert(key.into(), value.into());
    }
}

/// Benchmark configuration
#[derive(Debug, Clone)]
pub struct BenchmarkConfig {
    /// Number of iterations to run
    pub iterations: u32,
    /// Warmup iterations (not counted in results)
    pub warmup_iterations: u32,
    /// Timeout for each iteration
    pub iteration_timeout: Duration,
    /// Whether to collect memory usage statistics
    pub collect_memory_stats: bool,
    /// Whether to collect system resource usage
    pub collect_system_stats: bool,
    /// Sample interval for continuous monitoring
    pub sample_interval: Duration,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            iterations: 10,
            warmup_iterations: 3,
            iteration_timeout: Duration::from_secs(30),
            collect_memory_stats: true,
            collect_system_stats: true,
            sample_interval: Duration::from_millis(100),
        }
    }
}

/// Benchmark results with statistical analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResults {
    pub operation_name: String,
    pub total_iterations: u32,
    pub successful_iterations: u32,
    pub failed_iterations: u32,
    pub total_duration_ms: u64,
    pub min_duration_ms: u64,
    pub max_duration_ms: u64,
    pub mean_duration_ms: u64,
    pub median_duration_ms: u64,
    pub stddev_duration_ms: f64,
    pub percentile_95_ms: u64,
    pub percentile_99_ms: u64,
    pub throughput_ops_per_sec: f64,
    pub memory_stats: MemoryStats,
    pub system_stats: SystemStats,
    pub individual_results: Vec<IterationResult>,
}

impl BenchmarkResults {
    /// Calculate statistical measures from individual results
    pub fn calculate_statistics(&mut self) {
        if self.individual_results.is_empty() {
            return;
        }

        // Sort durations for percentile calculations
        let mut durations: Vec<u64> = self
            .individual_results
            .iter()
            .filter(|r| r.success)
            .map(|r| r.duration_ms)
            .collect();
        durations.sort();

        if durations.is_empty() {
            return;
        }

        // Basic statistics
        self.min_duration_ms = durations[0];
        self.max_duration_ms = *durations.last().unwrap();

        // Mean
        let sum: u64 = durations.iter().sum();
        self.mean_duration_ms = sum / durations.len() as u64;

        // Median
        let mid = durations.len() / 2;
        self.median_duration_ms = if durations.len() % 2 == 0 {
            (durations[mid - 1] + durations[mid]) / 2
        } else {
            durations[mid]
        };

        // Standard deviation
        let variance: f64 = durations
            .iter()
            .map(|&x| {
                let diff = x as f64 - self.mean_duration_ms as f64;
                diff * diff
            })
            .sum::<f64>()
            / durations.len() as f64;
        self.stddev_duration_ms = variance.sqrt();

        // Percentiles
        self.percentile_95_ms = self.calculate_percentile(&durations, 0.95);
        self.percentile_99_ms = self.calculate_percentile(&durations, 0.99);

        // Throughput
        if self.total_duration_ms > 0 {
            let duration_secs = self.total_duration_ms as f64 / 1000.0;
            self.throughput_ops_per_sec = self.successful_iterations as f64 / duration_secs;
        }
    }

    fn calculate_percentile(&self, sorted_durations: &[u64], percentile: f64) -> u64 {
        if sorted_durations.is_empty() {
            return 0;
        }

        let index = (sorted_durations.len() as f64 * percentile) as usize;
        let clamped_index = index.min(sorted_durations.len() - 1);
        sorted_durations[clamped_index]
    }
}

/// Individual benchmark iteration result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IterationResult {
    pub iteration: u32,
    pub success: bool,
    pub duration_ms: u64,
    pub memory_usage_bytes: u64,
    pub error_message: Option<String>,
    pub timestamp: u64,
}

/// Memory usage statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryStats {
    pub peak_memory_bytes: u64,
    pub average_memory_bytes: u64,
    pub min_memory_bytes: u64,
    pub max_memory_bytes: u64,
    pub memory_samples: Vec<u64>,
}

/// System resource usage statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemStats {
    pub cpu_usage_percent: f64,
    pub memory_usage_percent: f64,
    pub disk_io_bytes_per_sec: u64,
    pub network_io_bytes_per_sec: u64,
}

/// Performance monitor for collecting metrics and running benchmarks
pub struct PerformanceMonitor {
    metrics: Arc<RwLock<HashMap<String, Vec<PerformanceMetrics>>>>,
    active_timers: Arc<RwLock<HashMap<String, Instant>>>,
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
            active_timers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start timing an operation
    pub async fn start_timer(&self, operation_id: String) {
        let mut timers = self.active_timers.write().await;
        timers.insert(operation_id, Instant::now());
    }

    /// End timing and record metrics
    pub async fn end_timer(
        &self,
        operation_id: String,
        operation_name: String,
    ) -> Result<Duration, EngineError> {
        let start_time = {
            let mut timers = self.active_timers.write().await;
            timers.remove(&operation_id)
        };

        match start_time {
            Some(start) => {
                let duration = start.elapsed();
                let mut metric = PerformanceMetrics::new(operation_name);
                metric.duration_ms = duration.as_millis() as u64;
                metric.operations_count = 1;
                metric.calculate_throughput();

                self.record_metric(metric).await;
                Ok(duration)
            }
            None => Err(EngineError::ValidationError(format!(
                "No active timer found for operation: {}",
                operation_id
            ))),
        }
    }

    /// Record a performance metric
    pub async fn record_metric(&self, metric: PerformanceMetrics) {
        let mut metrics = self.metrics.write().await;
        metrics
            .entry(metric.operation.clone())
            .or_insert_with(Vec::new)
            .push(metric);
    }

    /// Get all metrics for an operation
    pub async fn get_metrics(&self, operation_name: &str) -> Vec<PerformanceMetrics> {
        let metrics = self.metrics.read().await;
        metrics.get(operation_name).cloned().unwrap_or_default()
    }

    /// Get aggregated metrics for an operation
    pub async fn get_aggregated_metrics(&self, operation_name: &str) -> Option<PerformanceMetrics> {
        let metrics = self.get_metrics(operation_name).await;
        if metrics.is_empty() {
            return None;
        }

        let mut aggregated = PerformanceMetrics::new(operation_name.to_string());

        for metric in &metrics {
            aggregated.duration_ms += metric.duration_ms;
            aggregated.memory_usage_bytes =
                aggregated.memory_usage_bytes.max(metric.memory_usage_bytes);
            aggregated.operations_count += metric.operations_count;
            aggregated.error_count += metric.error_count;
        }

        aggregated.calculate_throughput();
        aggregated.calculate_success_rate();
        aggregated.timestamp = metrics.last().unwrap().timestamp;

        Some(aggregated)
    }

    /// Run a benchmark on a provided closure
    pub async fn benchmark<F, Fut, T>(
        &self,
        name: String,
        config: BenchmarkConfig,
        mut operation: F,
    ) -> Result<BenchmarkResults, EngineError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, EngineError>>,
    {
        let mut results = BenchmarkResults {
            operation_name: name.clone(),
            total_iterations: config.iterations,
            successful_iterations: 0,
            failed_iterations: 0,
            total_duration_ms: 0,
            min_duration_ms: u64::MAX,
            max_duration_ms: 0,
            mean_duration_ms: 0,
            median_duration_ms: 0,
            stddev_duration_ms: 0.0,
            percentile_95_ms: 0,
            percentile_99_ms: 0,
            throughput_ops_per_sec: 0.0,
            memory_stats: MemoryStats::default(),
            system_stats: SystemStats::default(),
            individual_results: Vec::new(),
        };

        let benchmark_start = Instant::now();

        // Warmup iterations
        for _i in 0..config.warmup_iterations {
            let _ = tokio::time::timeout(config.iteration_timeout, operation()).await;
        }

        // Actual benchmark iterations
        for iteration in 0..config.iterations {
            let iteration_start = Instant::now();
            let start_memory = self.get_current_memory_usage().await;

            let result = tokio::time::timeout(config.iteration_timeout, operation()).await;

            let duration = iteration_start.elapsed();
            let end_memory = self.get_current_memory_usage().await;

            let iteration_result = match result {
                Ok(Ok(_)) => {
                    results.successful_iterations += 1;
                    IterationResult {
                        iteration,
                        success: true,
                        duration_ms: duration.as_millis() as u64,
                        memory_usage_bytes: end_memory.saturating_sub(start_memory),
                        error_message: None,
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    }
                }
                Ok(Err(e)) => {
                    results.failed_iterations += 1;
                    IterationResult {
                        iteration,
                        success: false,
                        duration_ms: duration.as_millis() as u64,
                        memory_usage_bytes: end_memory.saturating_sub(start_memory),
                        error_message: Some(e.to_string()),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    }
                }
                Err(_) => {
                    results.failed_iterations += 1;
                    IterationResult {
                        iteration,
                        success: false,
                        duration_ms: config.iteration_timeout.as_millis() as u64,
                        memory_usage_bytes: 0,
                        error_message: Some("Operation timed out".to_string()),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                    }
                }
            };

            results.individual_results.push(iteration_result);
        }

        results.total_duration_ms = benchmark_start.elapsed().as_millis() as u64;
        results.calculate_statistics();

        // Collect memory and system stats if enabled
        if config.collect_memory_stats {
            results.memory_stats = self.collect_memory_stats(&results.individual_results).await;
        }

        if config.collect_system_stats {
            results.system_stats = self.collect_system_stats().await;
        }

        // Record the benchmark result as a metric
        let mut metric = PerformanceMetrics::new(name.clone());
        metric.duration_ms = results.total_duration_ms;
        metric.operations_count = results.successful_iterations as u64;
        metric.error_count = results.failed_iterations as u64;
        metric.throughput_ops_per_sec = results.throughput_ops_per_sec;
        metric.calculate_success_rate();
        metric.add_metadata("benchmark_type", "full_benchmark");
        metric.add_metadata("iterations", results.total_iterations.to_string());

        self.record_metric(metric).await;

        Ok(results)
    }

    /// Get current memory usage (simplified implementation)
    async fn get_current_memory_usage(&self) -> u64 {
        // In a real implementation, this would use system APIs
        // For now, return a placeholder value

        // This is a simplified approach - in production you'd want more accurate memory tracking
        std::process::id() as u64 * 1024 // Placeholder
    }

    /// Collect memory statistics from iteration results
    async fn collect_memory_stats(&self, results: &[IterationResult]) -> MemoryStats {
        let memory_values: Vec<u64> = results.iter().map(|r| r.memory_usage_bytes).collect();

        if memory_values.is_empty() {
            return MemoryStats::default();
        }

        let min_memory = *memory_values.iter().min().unwrap_or(&0);
        let max_memory = *memory_values.iter().max().unwrap_or(&0);
        let sum: u64 = memory_values.iter().sum();
        let average = sum / memory_values.len() as u64;

        MemoryStats {
            peak_memory_bytes: max_memory,
            average_memory_bytes: average,
            min_memory_bytes: min_memory,
            max_memory_bytes: max_memory,
            memory_samples: memory_values,
        }
    }

    /// Collect system statistics (simplified implementation)
    async fn collect_system_stats(&self) -> SystemStats {
        // In a real implementation, this would use sysinfo crate or similar
        SystemStats {
            cpu_usage_percent: 0.0,    // Placeholder
            memory_usage_percent: 0.0, // Placeholder
            disk_io_bytes_per_sec: 0,
            network_io_bytes_per_sec: 0,
        }
    }

    /// Clear all recorded metrics
    pub async fn clear_metrics(&self) {
        let mut metrics = self.metrics.write().await;
        metrics.clear();
    }

    /// Get all operation names that have metrics
    pub async fn get_operation_names(&self) -> Vec<String> {
        let metrics = self.metrics.read().await;
        metrics.keys().cloned().collect()
    }

    /// Export metrics to JSON format
    pub async fn export_metrics_json(&self) -> Result<String, EngineError> {
        let metrics = self.metrics.read().await;
        serde_json::to_string_pretty(&*metrics).map_err(EngineError::from)
    }
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_performance_monitor_creation() {
        let monitor = PerformanceMonitor::new();
        let operations = monitor.get_operation_names().await;
        assert!(operations.is_empty());
    }

    #[tokio::test]
    async fn test_timer_functionality() {
        let monitor = PerformanceMonitor::new();

        monitor.start_timer("test_op".to_string()).await;
        sleep(Duration::from_millis(10)).await;
        let duration = monitor
            .end_timer("test_op".to_string(), "test_operation".to_string())
            .await
            .unwrap();

        assert!(duration.as_millis() >= 10);

        let metrics = monitor.get_metrics("test_operation").await;
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].operation, "test_operation");
        assert!(metrics[0].duration_ms >= 10);
    }

    #[tokio::test]
    async fn test_metric_recording() {
        let monitor = PerformanceMonitor::new();

        let mut metric = PerformanceMetrics::new("test_op".to_string());
        metric.duration_ms = 100;
        metric.operations_count = 5;
        metric.error_count = 1;
        metric.calculate_throughput();
        metric.calculate_success_rate();

        monitor.record_metric(metric).await;

        let metrics = monitor.get_metrics("test_op").await;
        assert_eq!(metrics.len(), 1);
        assert_eq!(metrics[0].duration_ms, 100);
        assert_eq!(metrics[0].operations_count, 5);
        assert_eq!(metrics[0].success_rate, 0.8); // 4/5 = 0.8
    }

    #[tokio::test]
    async fn test_aggregated_metrics() {
        let monitor = PerformanceMonitor::new();

        // Record multiple metrics
        for i in 0..3 {
            let mut metric = PerformanceMetrics::new("batch_op".to_string());
            metric.duration_ms = (i + 1) * 100;
            metric.operations_count = 10;
            metric.error_count = i;
            monitor.record_metric(metric).await;
        }

        let aggregated = monitor.get_aggregated_metrics("batch_op").await.unwrap();
        assert_eq!(aggregated.duration_ms, 600); // 100 + 200 + 300
        assert_eq!(aggregated.operations_count, 30); // 10 * 3
        assert_eq!(aggregated.error_count, 3); // 0 + 1 + 2
    }

    #[tokio::test]
    async fn test_benchmark_functionality() {
        let monitor = PerformanceMonitor::new();

        let config = BenchmarkConfig {
            iterations: 3,
            warmup_iterations: 1,
            iteration_timeout: Duration::from_secs(1),
            collect_memory_stats: true,
            collect_system_stats: false,
            sample_interval: Duration::from_millis(100),
        };

        let results = monitor
            .benchmark("test_benchmark".to_string(), config, || async {
                sleep(Duration::from_millis(10)).await;
                Ok::<(), EngineError>(())
            })
            .await
            .unwrap();

        assert_eq!(results.operation_name, "test_benchmark");
        assert_eq!(results.total_iterations, 3);
        assert_eq!(results.successful_iterations, 3);
        assert_eq!(results.failed_iterations, 0);
        assert!(results.total_duration_ms > 0);
        assert!(results.throughput_ops_per_sec > 0.0);
    }

    #[tokio::test]
    async fn test_benchmark_with_failures() {
        let monitor = PerformanceMonitor::new();

        let config = BenchmarkConfig::default();

        let mut call_count = 0;
        let results = monitor
            .benchmark("failing_benchmark".to_string(), config, || {
                call_count += 1;
                async move {
                    if call_count % 2 == 0 {
                        Err(EngineError::ValidationError(
                            "Simulated failure".to_string(),
                        ))
                    } else {
                        Ok(())
                    }
                }
            })
            .await
            .unwrap();

        assert!(results.failed_iterations > 0);
        assert!(results.successful_iterations > 0);
        assert_eq!(
            results.total_iterations,
            results.successful_iterations + results.failed_iterations
        );
    }

    #[tokio::test]
    async fn test_benchmark_statistics() {
        let monitor = PerformanceMonitor::new();

        let config = BenchmarkConfig {
            iterations: 5,
            warmup_iterations: 0,
            ..Default::default()
        };

        let results = monitor
            .benchmark("stats_benchmark".to_string(), config, || async {
                // Variable delay to create different durations
                let delay = fastrand::u64(5..15);
                sleep(Duration::from_millis(delay)).await;
                Ok::<(), EngineError>(())
            })
            .await
            .unwrap();

        assert!(results.min_duration_ms > 0);
        assert!(results.max_duration_ms >= results.min_duration_ms);
        assert!(results.mean_duration_ms > 0);
        assert!(results.median_duration_ms > 0);
        assert!(results.percentile_95_ms >= results.mean_duration_ms);
        assert!(results.percentile_99_ms >= results.percentile_95_ms);
    }

    #[tokio::test]
    async fn test_metrics_export() {
        let monitor = PerformanceMonitor::new();

        let metric = PerformanceMetrics::new("export_test".to_string());
        monitor.record_metric(metric).await;

        let json = monitor.export_metrics_json().await.unwrap();
        assert!(json.contains("export_test"));
        assert!(json.contains("duration_ms"));
    }
}
