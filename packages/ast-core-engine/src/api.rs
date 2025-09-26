//! TypeScript API Layer for AST Core Engine
//!
//! This module provides NAPI-RS bindings to expose the Rust engine functionality 
//! to TypeScript applications.

use crate::{
    ast_processor::AstProcessor,
    batch_processor::BatchProcessor,
    config::{EngineConfig, HnswConfig},
    performance_monitor::PerformanceMonitor,
    storage::StorageLayer,
    types::{EngineHealth, NodeMetadata, ProcessingOptions, BatchResult},
    vector_db::SimpleVectorDb,
};
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;

type Result<T> = std::result::Result<T, napi::Error>;

/// Main AST Core Engine - NAPI bindings for TypeScript
#[napi]
pub struct AstCoreEngineApi {
    config: EngineConfig,
    ast_processor: Option<Arc<AstProcessor>>,
    vector_db: Option<Arc<SimpleVectorDb>>,
    storage: Option<Arc<StorageLayer>>,
    performance_monitor: Arc<PerformanceMonitor>,
    batch_processor: Option<Arc<Mutex<BatchProcessor>>>,
}

#[napi]
impl AstCoreEngineApi {
    /// Create new engine instance
    #[napi(constructor)]
    pub fn new(config: Option<EngineConfig>) -> Result<Self> {
        let config = config.unwrap_or_default();
        let performance_monitor = Arc::new(PerformanceMonitor::new());
        
        Ok(Self {
            config,
            ast_processor: None,
            vector_db: None,
            storage: None,
            performance_monitor,
            batch_processor: None,
        })
    }

    /// Initialize the engine components
    #[napi]
    pub async unsafe fn initialize(&mut self) -> Result<()> {
        // Initialize AST processor
        let ast_processor = Arc::new(AstProcessor::new(self.config.parallel_workers as usize));
        self.ast_processor = Some(ast_processor.clone());

        // Initialize vector database
        let vector_db = Arc::new(SimpleVectorDb::new(self.config.hnsw_config.clone()));
        vector_db.initialize().map_err(|e| napi::Error::from_reason(format!("Vector DB init failed: {}", e)))?;
        self.vector_db = Some(vector_db.clone());

        // Initialize storage
        let storage = Arc::new(StorageLayer::new(self.config.storage_config.clone()).await?);
        self.storage = Some(storage.clone());

        // Initialize batch processor
        let batch_config = crate::batch_processor::BatchConfig {
            max_concurrent_files: self.config.parallel_workers as usize,
            db_batch_size: self.config.batch_size as usize,
            max_memory_usage: 1024 * 1024 * 1024, // 1GB default
            progress_interval: std::time::Duration::from_secs(1),
            continue_on_error: true,
            max_file_size: 10 * 1024 * 1024, // 10MB default
            supported_extensions: vec![".rs".to_string(), ".ts".to_string(), ".js".to_string()],
        };
        let batch_processor = crate::batch_processor::BatchProcessor::new(ast_processor, storage, batch_config);
        self.batch_processor = Some(Arc::new(Mutex::new(batch_processor)));

        Ok(())
    }

    /// Get engine health status
    #[napi]
    pub async fn get_health(&self) -> Result<EngineHealth> {
        let memory_usage = self.get_memory_usage().await?;
        
        Ok(EngineHealth {
            status: "healthy".to_string(),
            memory_usage_mb: (memory_usage / (1024 * 1024)) as u32,
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as u32,
        })
    }

    /// Get current memory usage
    #[napi]
    pub async fn get_memory_usage(&self) -> Result<u64> {
        // Simple memory usage estimation
        Ok(1024 * 1024 * 100) // 100MB placeholder
    }

    /// Process a single file and extract metadata
    #[napi]
    pub async fn process_file(&self, file_path: String) -> Result<NodeMetadata> {
        let _ast_processor = self.ast_processor.as_ref()
            .ok_or_else(|| napi::Error::from_reason("AST processor not initialized"))?;

        // Return simplified metadata (placeholder implementation)
        let metadata = NodeMetadata {
            node_id: "example_id".to_string(),
            file_path: file_path.clone(),
            signature: "example_signature".to_string(),
            summary: "example_summary".to_string(),
            source_snippet: "example_snippet".to_string(),
            complexity: 1,
            language: "rust".to_string(),
        };

        Ok(metadata)
    }

    /// Process multiple files in batch
    #[napi]
    pub async fn process_batch(
        &self,
        file_paths: Vec<String>,
        options: Option<ProcessingOptions>,
    ) -> Result<BatchResult> {
        let batch_processor = self.batch_processor.as_ref()
            .ok_or_else(|| napi::Error::from_reason("Batch processor not initialized"))?;

        let options = options.unwrap_or(ProcessingOptions {
            max_memory_mb: 1024,
            batch_size: 100,
            parallel_workers: 4,
            vector_dimensions: 768,
            index_ef_construction: 200,
            index_m: 16,
            max_depth: 10,
            include_unnamed_nodes: false,
            max_node_length: 1000,
            enable_caching: true,
        });

        let mut processor = batch_processor.lock().await;
        
        // Start processing
        let start_time = std::time::Instant::now();
        let results = processor.process_files(
            file_paths.iter().map(|p| std::path::PathBuf::from(p)).collect(),
            None, // No progress callback for now
        ).await.map_err(|e| napi::Error::from_reason(format!("Batch processing failed: {}", e)))?;

        let processing_time = start_time.elapsed();

        // Convert results to API format
        let errors = results.iter()
            .filter_map(|r| if r.success { None } else { 
                Some(crate::types::ProcessingError {
                    file_path: r.file_path.display().to_string(),
                    error_type: "processing_error".to_string(),
                    message: r.error.as_ref().map_or("Unknown error".to_string(), |e| e.to_string()),
                })
            })
            .collect::<Vec<_>>();

        let error_count = errors.len();
        let success_count = results.len() - error_count;

        Ok(BatchResult {
            processed_files: success_count as u32,
            total_nodes: success_count as u32 * 10, // Estimate
            processing_time_ms: processing_time.as_millis() as u32,
            memory_peak_mb: 100, // Placeholder
            errors,
            performance_metrics: crate::types::PerformanceMetrics {
                parse_time_ms: processing_time.as_millis() as u32 / 2,
                embedding_time_ms: processing_time.as_millis() as u32 / 4,
                vector_search_time_ms: 0,
                memory_usage_mb: 100,
                throughput_files_per_sec: success_count as f64 / processing_time.as_secs_f64().max(0.001),
                error_rate: error_count as f64 / results.len() as f64,
            },
        })
    }

    /// Get batch processing progress (returns JSON string)
    #[napi]
    pub async fn get_batch_progress(&self) -> Result<Option<String>> {
        if let Some(batch_processor) = &self.batch_processor {
            let processor = batch_processor.lock().await;
            let progress = processor.get_progress().await;
            Ok(Some(serde_json::to_string(&progress)
                .map_err(|e| napi::Error::from_reason(format!("Serialization error: {}", e)))?))
        } else {
            Ok(None)
        }
    }

    /// Cancel current batch processing
    #[napi]
    pub async fn cancel_batch(&self) -> Result<()> {
        if let Some(batch_processor) = &self.batch_processor {
            let processor = batch_processor.lock().await;
            processor.cancel().await;
        }
        Ok(())
    }

    /// Search for similar AST nodes
    #[napi]
    pub async fn search_similar(
        &self,
        query: String,
        limit: Option<u32>,
    ) -> Result<Vec<NodeMetadata>> {
        let _vector_db = self.vector_db.as_ref()
            .ok_or_else(|| napi::Error::from_reason("Vector database not initialized"))?;

        let _limit = limit.unwrap_or(10);

        // Placeholder implementation - return empty results
        Ok(vec![])
    }

    /// Store metadata for an AST node
    #[napi]
    pub async fn store_metadata(&self, _node_id: String, metadata: NodeMetadata) -> Result<()> {
        if let Some(storage) = &self.storage {
            storage.store_metadata(&metadata).await
                .map_err(|e| napi::Error::from_reason(format!("Storage error: {}", e)))?;
        }
        Ok(())
    }

    /// Retrieve metadata for an AST node
    #[napi]
    pub async fn get_metadata(&self, node_id: String) -> Result<Option<NodeMetadata>> {
        if let Some(storage) = &self.storage {
            let metadata = storage.get_metadata(&node_id).await
                .map_err(|e| napi::Error::from_reason(format!("Storage error: {}", e)))?;
            Ok(metadata)
        } else {
            Ok(None)
        }
    }

    /// Start performance timer
    #[napi]
    pub async fn start_timer(&self, operation_name: String) -> Result<String> {
        self.performance_monitor.start_timer(operation_name.clone()).await;
        Ok(operation_name) // Return the operation name as the timer ID
    }

    /// End performance timer and return duration
    #[napi]
    pub async fn end_timer(&self, operation_id: String, operation_name: String) -> Result<f64> {
        let duration = self.performance_monitor.end_timer(operation_id, operation_name).await
            .map_err(|e| napi::Error::from_reason(format!("Timer error: {}", e)))?;
        Ok(duration.as_secs_f64())
    }

    /// Get performance metrics (returns JSON string)
    #[napi]
    pub async fn get_metrics(&self, operation_name: String) -> Result<String> {
        let metrics = self.performance_monitor.get_metrics(&operation_name).await;
        serde_json::to_string(&metrics)
            .map_err(|e| napi::Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Run benchmark (returns JSON string)
    #[napi]
    pub async fn run_benchmark(&self, operation_name: String) -> Result<String> {
        let config = crate::performance_monitor::BenchmarkConfig::default();
        
        let _results = self.performance_monitor.benchmark(
            operation_name.clone(),
            config,
            || async {
                // Simple benchmark operation
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                Ok(())
            },
        ).await;

        // Return simplified benchmark result as JSON
        let simple_result = serde_json::json!({
            "operation": operation_name,
            "status": "completed",
            "duration_ms": 10,
            "success": true
        });

        Ok(simple_result.to_string())
    }
}

/// Helper functions for configuration

/// Create HNSW config helper
#[napi]
pub fn create_hnsw_config(
    embedding_dimension: u32,
    m: Option<u32>,
    ef_construction: Option<u32>,
) -> HnswConfig {
    HnswConfig {
        embedding_dimension,
        m: m.unwrap_or(16),
        ef_construction: ef_construction.unwrap_or(200),
        ef_search: 100,
        max_elements: 1_000_000,
    }
}

/// Initialize engine with custom configuration
#[napi]
pub async fn create_engine_with_config(config: EngineConfig) -> Result<AstCoreEngineApi> {
    let mut engine = AstCoreEngineApi::new(Some(config))?;
    unsafe { engine.initialize().await?; }
    Ok(engine)
}

/// Quick initialization with defaults
#[napi]
pub async fn create_default_engine() -> Result<AstCoreEngineApi> {
    let mut engine = AstCoreEngineApi::new(None)?;
    unsafe { engine.initialize().await?; }
    Ok(engine)
}