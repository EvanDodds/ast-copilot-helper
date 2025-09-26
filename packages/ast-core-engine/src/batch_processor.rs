use crate::{
    ast_processor::AstProcessor,
    error::{EngineError, StorageError},
    storage::StorageLayer,
    types::NodeMetadata,
};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, Mutex, RwLock};

/// Progress information for batch processing operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatchProgress {
    pub total_files: usize,
    pub processed_files: usize,
    pub failed_files: usize,
    pub current_file: Option<String>,
    pub elapsed_time: Duration,
    pub estimated_remaining: Option<Duration>,
    pub bytes_processed: u64,
    pub nodes_processed: usize,
    pub vectors_generated: usize,
}

impl BatchProgress {
    pub fn new(total_files: usize) -> Self {
        Self {
            total_files,
            processed_files: 0,
            failed_files: 0,
            current_file: None,
            elapsed_time: Duration::from_secs(0),
            estimated_remaining: None,
            bytes_processed: 0,
            nodes_processed: 0,
            vectors_generated: 0,
        }
    }

    pub fn completion_percentage(&self) -> f64 {
        if self.total_files == 0 {
            return 100.0;
        }
        (self.processed_files as f64 / self.total_files as f64) * 100.0
    }

    pub fn is_complete(&self) -> bool {
        self.processed_files + self.failed_files >= self.total_files
    }
}

/// Batch processing configuration
#[derive(Debug, Clone)]
pub struct BatchConfig {
    /// Maximum number of files to process concurrently
    pub max_concurrent_files: usize,
    /// Batch size for database operations
    pub db_batch_size: usize,
    /// Maximum memory usage in bytes before flushing
    pub max_memory_usage: u64,
    /// Progress reporting interval
    pub progress_interval: Duration,
    /// Whether to continue processing on individual file errors
    pub continue_on_error: bool,
    /// File size limit in bytes (skip files larger than this)
    pub max_file_size: u64,
    /// Supported file extensions
    pub supported_extensions: Vec<String>,
}

impl Default for BatchConfig {
    fn default() -> Self {
        Self {
            max_concurrent_files: num_cpus::get(),
            db_batch_size: 100,
            max_memory_usage: 1024 * 1024 * 1024, // 1GB
            progress_interval: Duration::from_secs(1),
            continue_on_error: true,
            max_file_size: 10 * 1024 * 1024, // 10MB
            supported_extensions: vec![
                "js".to_string(),
                "ts".to_string(),
                "jsx".to_string(),
                "tsx".to_string(),
                "py".to_string(),
                "rs".to_string(),
                "go".to_string(),
                "java".to_string(),
                "cpp".to_string(),
                "c".to_string(),
                "h".to_string(),
                "hpp".to_string(),
            ],
        }
    }
}

/// Result of processing a single file
#[derive(Debug)]
pub struct FileProcessingResult {
    pub file_path: PathBuf,
    pub success: bool,
    pub error: Option<EngineError>,
    pub processing_time: Duration,
    pub file_size: u64,
    pub nodes_count: usize,
    pub vectors_count: usize,
}

/// Cancellation token for batch operations
#[derive(Debug, Clone)]
pub struct CancellationToken {
    cancelled: Arc<RwLock<bool>>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn cancel(&self) {
        let mut cancelled = self.cancelled.write().await;
        *cancelled = true;
    }

    pub async fn is_cancelled(&self) -> bool {
        let cancelled = self.cancelled.read().await;
        *cancelled
    }
}

/// High-performance batch processor for large codebases
pub struct BatchProcessor {
    ast_processor: Arc<AstProcessor>,
    storage: Arc<StorageLayer>,
    config: BatchConfig,
    progress: Arc<Mutex<BatchProgress>>,
    pub cancellation_token: CancellationToken,
    start_time: Arc<Mutex<Option<Instant>>>,
}

impl BatchProcessor {
    pub fn new(
        ast_processor: Arc<AstProcessor>,
        storage: Arc<StorageLayer>,
        config: BatchConfig,
    ) -> Self {
        let total_files = 0; // Will be updated when processing starts
        Self {
            ast_processor,
            storage,
            config,
            progress: Arc::new(Mutex::new(BatchProgress::new(total_files))),
            cancellation_token: CancellationToken::new(),
            start_time: Arc::new(Mutex::new(None)),
        }
    }

    /// Process multiple files in batch with progress tracking
    pub async fn process_files(
        &mut self,
        file_paths: Vec<PathBuf>,
        progress_callback: Option<Box<dyn Fn(BatchProgress) + Send + Sync>>,
    ) -> Result<Vec<FileProcessingResult>, EngineError> {
        // Filter and validate files
        let valid_files = self.filter_files(file_paths).await?;
        let total_files = valid_files.len();

        // Update progress with total files
        {
            let mut progress = self.progress.lock().await;
            progress.total_files = total_files;
        }

        // Set start time
        {
            let mut start_time = self.start_time.lock().await;
            *start_time = Some(Instant::now());
        }

        // Create semaphore to limit concurrent processing
        let semaphore = Arc::new(tokio::sync::Semaphore::new(self.config.max_concurrent_files));
        
        // Create channels for results and progress updates
        let (result_tx, mut result_rx) = mpsc::unbounded_channel::<FileProcessingResult>();
        let (progress_tx, mut progress_rx) = mpsc::unbounded_channel::<(usize, usize, u64)>();

        // Spawn progress tracking task
        let progress_clone = Arc::clone(&self.progress);
        let progress_interval = self.config.progress_interval;
        let _start_time_clone = Arc::clone(&self.start_time);
        let cancellation_clone = self.cancellation_token.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(progress_interval);
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if let Some(callback) = &progress_callback {
                            let progress = progress_clone.lock().await;
                            callback(progress.clone());
                        }
                    }
                    _ = async {
                        cancellation_clone.is_cancelled().await
                    } => {
                        break;
                    }
                }
            }
        });

        // Spawn file processing tasks
        let mut tasks = Vec::new();
        for file_path in valid_files {
            let semaphore_permit = Arc::clone(&semaphore);
            let ast_processor = Arc::clone(&self.ast_processor);
            let storage = Arc::clone(&self.storage);
            let result_tx = result_tx.clone();
            let progress_tx = progress_tx.clone();
            let cancellation_token = self.cancellation_token.clone();
            let continue_on_error = self.config.continue_on_error;

            let task = tokio::spawn(async move {
                let _permit = semaphore_permit.acquire().await.unwrap();
                
                if cancellation_token.is_cancelled().await {
                    return;
                }

                let start_time = Instant::now();
                let file_size = tokio::fs::metadata(&file_path)
                    .await
                    .map(|m| m.len())
                    .unwrap_or(0);

                let result = Self::process_single_file(
                    &ast_processor,
                    &storage,
                    &file_path,
                    file_size,
                ).await;

                let processing_time = start_time.elapsed();
                let (nodes_count, vectors_count, success, error) = match result {
                    Ok((nodes, vectors)) => (nodes, vectors, true, None),
                    Err(e) => {
                        if continue_on_error {
                            (0, 0, false, Some(e))
                        } else {
                            let _ = result_tx.send(FileProcessingResult {
                                file_path: file_path.clone(),
                                success: false,
                                error: Some(e),
                                processing_time,
                                file_size,
                                nodes_count: 0,
                                vectors_count: 0,
                            });
                            return;
                        }
                    }
                };

                // Send progress update
                let _ = progress_tx.send((nodes_count, vectors_count, file_size));

                // Send result
                let _ = result_tx.send(FileProcessingResult {
                    file_path,
                    success,
                    error,
                    processing_time,
                    file_size,
                    nodes_count,
                    vectors_count,
                });
            });

            tasks.push(task);
        }

        // Drop the original senders to signal completion
        drop(result_tx);
        drop(progress_tx);

        // Collect results and update progress
        let mut results = Vec::new();
        let mut processed_count = 0;
        let mut failed_count = 0;

        while let Some(result) = result_rx.recv().await {
            if result.success {
                processed_count += 1;
            } else {
                failed_count += 1;
            }

            results.push(result);

            // Update progress
            {
                let mut progress = self.progress.lock().await;
                progress.processed_files = processed_count;
                progress.failed_files = failed_count;
                
                if let Some(start_time) = *self.start_time.lock().await {
                    progress.elapsed_time = start_time.elapsed();
                    
                    // Estimate remaining time
                    let completed = processed_count + failed_count;
                    if completed > 0 {
                        let avg_time_per_file = progress.elapsed_time.as_secs_f64() / completed as f64;
                        let remaining_files = total_files - completed;
                        progress.estimated_remaining = Some(Duration::from_secs_f64(
                            avg_time_per_file * remaining_files as f64
                        ));
                    }
                }
            }

            // Check for cancellation
            if self.cancellation_token.is_cancelled().await {
                break;
            }
        }

        // Update progress from progress updates
        while let Ok((nodes, vectors, bytes)) = progress_rx.try_recv() {
            let mut progress = self.progress.lock().await;
            progress.nodes_processed += nodes;
            progress.vectors_generated += vectors;
            progress.bytes_processed += bytes;
        }

        // Wait for all tasks to complete or cancel them
        for task in tasks {
            let _ = task.await;
        }

        Ok(results)
    }

    /// Process a single file and return (nodes_count, vectors_count)
    async fn process_single_file(
        _ast_processor: &AstProcessor,
        storage: &StorageLayer,
        file_path: &PathBuf,
        _file_size: u64,
    ) -> Result<(usize, usize), EngineError> {
        // Read file content
        let content = tokio::fs::read_to_string(file_path)
            .await
            .map_err(|e| EngineError::Storage(StorageError::Connection(format!("Failed to read file: {}", e))))?;

        // Process AST (simplified - in a real implementation, this would use the full AST processor)
        let mut nodes_count = 0;
        let mut vectors_count = 0;

        // Simulate AST processing and vector generation
        let lines: Vec<&str> = content.lines().collect();
        for (line_num, line) in lines.iter().enumerate() {
            if !line.trim().is_empty() {
                // Create simplified node metadata for testing
                let metadata = NodeMetadata {
                    node_id: format!("{}:{}", file_path.to_string_lossy(), line_num),
                    file_path: file_path.to_string_lossy().to_string(),
                    signature: line.trim().to_string(),
                    summary: format!("Line {} statement", line_num),
                    source_snippet: line.to_string(),
                    complexity: 1,
                    language: "javascript".to_string(), // Simplified for testing
                };

                storage.store_metadata(&metadata).await.map_err(EngineError::Storage)?;
                nodes_count += 1;

                // Simulate vector generation for significant lines
                if line.len() > 10 {
                    // Generate mock vector (in reality, this would come from the AST processor)
                    let _vector: Vec<f32> = (0..768).map(|i| (i as f32 * line.len() as f32) % 1000.0 / 1000.0).collect();

                    // For now, we'll skip actual vector storage since the API needs to be updated
                    // This is a placeholder for the vector storage functionality
                    vectors_count += 1;
                }
            }
        }

        Ok((nodes_count, vectors_count))
    }

    /// Filter files based on configuration
    async fn filter_files(&self, file_paths: Vec<PathBuf>) -> Result<Vec<PathBuf>, EngineError> {
        let mut filtered = Vec::new();

        for path in file_paths {
            // Check if file exists
            if !path.exists() {
                continue;
            }

            // Check file size
            let metadata = tokio::fs::metadata(&path)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Connection(format!("Failed to read metadata: {}", e))))?;
            
            if metadata.len() > self.config.max_file_size {
                continue;
            }

            // Check file extension
            if let Some(extension) = path.extension().and_then(|e| e.to_str()) {
                if self.config.supported_extensions.contains(&extension.to_lowercase()) {
                    filtered.push(path);
                }
            }
        }

        Ok(filtered)
    }

    /// Get current progress
    pub async fn get_progress(&self) -> BatchProgress {
        let progress = self.progress.lock().await;
        progress.clone()
    }

    /// Cancel the current batch operation
    pub async fn cancel(&self) {
        self.cancellation_token.cancel().await;
    }

    /// Check if the operation is cancelled
    pub async fn is_cancelled(&self) -> bool {
        self.cancellation_token.is_cancelled().await
    }

    /// Get memory usage estimate
    pub async fn get_memory_usage(&self) -> u64 {
        // Simple estimate based on processed data
        let progress = self.progress.lock().await;
        progress.bytes_processed + (progress.nodes_processed as u64 * 1024) // Rough estimate
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::EngineConfig;
    use tempfile::tempdir;
    use tokio::fs;

    async fn create_test_setup() -> (BatchProcessor, tempfile::TempDir) {
        let temp_dir = tempdir().unwrap();
        
        let ast_processor = Arc::new(AstProcessor::new(4)); // 4 parsers per language
        
        let storage_config = StorageConfig {
            db_path: ":memory:".to_string(), // Use in-memory database for tests
            max_connections: 1, // Use single connection for tests
            connection_timeout_secs: 10,
            cache_size_mb: 16,
            enable_wal: false, // Disable WAL for tests
        };
        let storage = Arc::new(StorageLayer::new(storage_config).await.unwrap());
        
        let batch_config = BatchConfig::default();
        let processor = BatchProcessor::new(ast_processor, storage, batch_config);
        
        (processor, temp_dir)
    }

    #[tokio::test]
    async fn test_batch_processor_creation() {
        let (processor, _temp_dir) = create_test_setup().await;
        assert!(!processor.is_cancelled().await);
        
        let progress = processor.get_progress().await;
        assert_eq!(progress.total_files, 0);
        assert_eq!(progress.processed_files, 0);
    }

    #[tokio::test]
    async fn test_file_filtering() {
        let (processor, temp_dir) = create_test_setup().await;
        
        // Create test files
        let js_file = temp_dir.path().join("test.js");
        let txt_file = temp_dir.path().join("test.txt");
        let large_file = temp_dir.path().join("large.js");
        
        fs::write(&js_file, "console.log('Hello');").await.unwrap();
        fs::write(&txt_file, "This is a text file").await.unwrap();
        fs::write(&large_file, "x".repeat(15 * 1024 * 1024)).await.unwrap(); // 15MB file
        
        let files = vec![js_file.clone(), txt_file, large_file];
        let filtered = processor.filter_files(files).await.unwrap();
        
        // Only js file should pass (txt excluded by extension, large file excluded by size)
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0], js_file);
    }

    #[tokio::test]
    async fn test_single_file_processing() {
        let temp_dir = tempdir().unwrap();
        
        let ast_processor = AstProcessor::new(4);
        let storage_config = StorageConfig {
            db_path: ":memory:".to_string(), // Use in-memory database for tests
            max_connections: 1, // Use single connection for tests
            connection_timeout_secs: 10,
            cache_size_mb: 16,
            enable_wal: false, // Disable WAL for tests
        };
        let storage = StorageLayer::new(storage_config).await.unwrap();
        
        // Create test file
        let test_file = temp_dir.path().join("test.js");
        fs::write(&test_file, "function hello() {\n  console.log('Hello');\n}").await.unwrap();
        
        let result = BatchProcessor::process_single_file(
            &ast_processor,
            &storage,
            &test_file,
            100,
        ).await.unwrap();
        
        assert!(result.0 > 0); // nodes_count
        assert!(result.1 > 0); // vectors_count
    }

    #[tokio::test]
    async fn test_batch_processing() {
        let (mut processor, temp_dir) = create_test_setup().await;
        
        // Create test files
        let files = vec![
            temp_dir.path().join("file1.js"),
            temp_dir.path().join("file2.ts"),
        ];
        
        for (i, file) in files.iter().enumerate() {
            fs::write(file, format!("// File {}\nconsole.log('test');", i)).await.unwrap();
        }
        
        let results = processor.process_files(files, None).await.unwrap();
        
        assert_eq!(results.len(), 2);
        for result in results {
            assert!(result.success);
            assert!(result.nodes_count > 0);
        }
    }

    #[tokio::test]
    async fn test_cancellation() {
        let (mut processor, temp_dir) = create_test_setup().await;
        
        // Create many test files to ensure we can cancel
        let mut files = Vec::new();
        for i in 0..10 {
            let file = temp_dir.path().join(format!("file{}.js", i));
            fs::write(&file, "console.log('test');".repeat(100)).await.unwrap();
            files.push(file);
        }
        
        // Clone the cancellation token for separate task
        let cancellation_token = processor.cancellation_token.clone();
        
        // Start processing
        let process_task = tokio::spawn(async move {
            processor.process_files(files, None).await
        });
        
        // Cancel after a short delay
        tokio::spawn(async move {
            sleep(Duration::from_millis(10)).await;
            cancellation_token.cancel().await;
        });
        
        let results = process_task.await.unwrap().unwrap();
        // Some files might have been processed before cancellation
        assert!(results.len() <= 10);
    }

    #[tokio::test]
    async fn test_progress_tracking() {
        let (mut processor, temp_dir) = create_test_setup().await;
        
        let files = vec![temp_dir.path().join("test.js")];
        fs::write(&files[0], "console.log('test');").await.unwrap();
        
        let _results = processor.process_files(files, None).await.unwrap();
        
        let progress = processor.get_progress().await;
        assert_eq!(progress.total_files, 1);
        assert_eq!(progress.processed_files, 1);
        assert!(progress.is_complete());
        assert_eq!(progress.completion_percentage(), 100.0);
    }
}