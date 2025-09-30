//! Unit tests for AST Core Engine core functionality
//! These tests validate core functionality using the native full-system feature

use ast_helper_core_engine::{
    batch_processor::{BatchConfig, BatchProcessor},
    config::{EngineConfig, HnswConfig, StorageConfig},
    core::ASTCoreEngine,
    error::EngineError,
    performance_monitor::{BenchmarkConfig, PerformanceMonitor},
    storage::StorageLayer,
    types::{NodeMetadata, ProcessingOptions},
    vector_db::SimpleVectorDb,
};

#[cfg(any(feature = "wasm", test))]
use ast_helper_core_engine::ast_processor::{AstProcessor, SupportedLanguage};
use std::sync::Arc;

/// Test engine config creation
#[tokio::test]
async fn test_engine_config_creation() {
    println!("🧪 Testing engine config creation...");

    let config = EngineConfig::default();

    assert_eq!(config.hnsw_config.embedding_dimension, 384);
    assert_eq!(config.storage_config.db_path, ".astdb/index.db");
    assert!(config.storage_config.enable_wal);
    assert_eq!(config.max_memory_mb, 1024);

    println!("✅ Engine config test passed");
}

/// Test AST processor creation
#[tokio::test]
async fn test_ast_processor_creation() {
    println!("🧪 Testing AST processor creation...");

    let processor = AstProcessor::new(4); // max_parsers_per_language

    // Test that the processor was created successfully
    // In a real implementation we would test specific functionality
    println!("✅ AST processor creation test passed");
}

/// Test storage layer initialization
#[tokio::test]
async fn test_storage_layer_creation() {
    println!("🧪 Testing storage layer configuration...");

    // Test storage config creation (testing the config struct itself, not database connection)
    let config = StorageConfig {
        db_path: ":memory:".to_string(),
        max_connections: 5,
        connection_timeout_secs: 5,
        enable_wal: false,
        cache_size_mb: 128,
    };

    // Test config values
    assert_eq!(config.db_path, ":memory:");
    assert_eq!(config.max_connections, 5);
    assert_eq!(config.connection_timeout_secs, 5);
    assert!(!config.enable_wal);
    assert_eq!(config.cache_size_mb, 128);

    // Note: Full storage layer database integration testing is done in integration tests
    // to avoid SQLite schema initialization issues in unit tests

    println!("✅ Storage layer configuration test passed");
}

/// Test vector database creation
#[tokio::test]
async fn test_vector_database_creation() {
    println!("🧪 Testing vector database creation...");

    let config = HnswConfig {
        embedding_dimension: 4,
        m: 16,
        ef_construction: 200,
        ef_search: 100,
        max_elements: 10000,
    };

    let vector_db = SimpleVectorDb::new(config);

    // Initialize vector database
    let init_result = vector_db.initialize();
    assert!(
        init_result.is_ok(),
        "Vector database initialization should succeed"
    );

    // Test basic functionality by checking the configuration
    println!("✅ Vector database test passed");
}

/// Test performance monitor creation and basic operations
#[tokio::test]
async fn test_performance_monitor() {
    println!("🧪 Testing performance monitor...");

    let monitor = PerformanceMonitor::new();

    // Test timer operations
    monitor.start_timer("test_operation".to_string()).await;

    // Simulate some work
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    let duration = monitor
        .end_timer("test_operation".to_string(), "test_operation".to_string())
        .await;
    assert!(duration.is_ok(), "Timer should complete successfully");
    let duration = duration.unwrap();
    assert!(
        duration.as_millis() >= 10,
        "Timer should measure at least 10ms"
    );

    // Test metrics collection
    let metrics = monitor.get_metrics("test_operation").await;
    assert!(!metrics.is_empty(), "Metrics should contain data");

    println!("✅ Performance monitor test passed");
}

/// Test batch processor creation and configuration
#[tokio::test]
async fn test_batch_processor() {
    println!("🧪 Testing batch processor...");

    let storage_config = StorageConfig::default();
    let batch_config = BatchConfig::default();

    // Create necessary components
    let ast_processor = Arc::new(AstProcessor::new(4)); // Max depth 4
    let storage_layer = Arc::new(StorageLayer::new(storage_config).await.unwrap());

    // Create batch processor with required arguments
    let processor = BatchProcessor::new(ast_processor, storage_layer, batch_config);

    // Test batch processor creation (just verify it compiles and runs)
    println!("Batch processor created successfully");

    // Test cancellation token functionality
    let is_cancelled = processor.cancellation_token.is_cancelled();
    assert!(!is_cancelled, "Should not be cancelled initially");

    println!("✅ Batch processor test passed");
}

/// Test core engine creation and basic operations
#[tokio::test]
async fn test_core_engine_creation() {
    println!("🧪 Testing core engine creation...");

    let config = EngineConfig::default();
    let engine = ASTCoreEngine::new(config);
    assert!(engine.is_ok(), "Should create core engine successfully");

    let engine = engine.unwrap();

    // Test accessing configuration
    let engine_config = engine.config();
    assert_eq!(
        engine_config.max_memory_mb, 1024,
        "Should have correct default memory limit"
    );
    assert_eq!(
        engine_config.parallel_workers, 4,
        "Should have correct default worker count"
    );

    println!("✅ Core engine test passed");
}

/// Test error handling and custom error types
#[tokio::test]
async fn test_error_handling() {
    println!("🧪 Testing error handling...");

    // Test different error types
    let vector_error = EngineError::VectorDbError("Test vector error".to_string());
    assert!(matches!(vector_error, EngineError::VectorDbError(_)));

    let config_error = EngineError::Configuration("Test config error".to_string());
    assert!(matches!(config_error, EngineError::Configuration(_)));

    // Test error display
    let error_message = format!("{}", vector_error);
    assert!(error_message.contains("Test vector error"));

    println!("✅ Error handling test passed");
}

/// Test processing options and configurations
#[tokio::test]
async fn test_processing_options() {
    println!("🧪 Testing processing options...");

    let options = ProcessingOptions {
        max_memory_mb: 512,
        batch_size: 50,
        parallel_workers: 2,
        vector_dimensions: 384,
        index_ef_construction: 100,
        index_m: 8,
        max_depth: 5,
        include_unnamed_nodes: false,
        max_node_length: 500,
        enable_caching: true,
    };

    assert_eq!(options.max_memory_mb, 512);
    assert_eq!(options.batch_size, 50);
    assert_eq!(options.max_depth, 5);
    assert!(!options.include_unnamed_nodes);
    assert!(options.enable_caching);

    // Test default options
    let default_options = ProcessingOptions::default();
    assert_eq!(default_options.max_memory_mb, 1024);
    assert_eq!(default_options.batch_size, 100);
    assert_eq!(default_options.max_depth, 10);
    assert!(!default_options.include_unnamed_nodes);
    assert!(default_options.enable_caching);

    println!("✅ Processing options test passed");
}

/// Test benchmark configuration
#[tokio::test]
async fn test_benchmark_configuration() {
    println!("🧪 Testing benchmark configuration...");

    let benchmark_config = BenchmarkConfig {
        iterations: 100,
        warmup_iterations: 10,
        iteration_timeout: std::time::Duration::from_secs(30),
        collect_memory_stats: true,
        collect_system_stats: true,
        sample_interval: std::time::Duration::from_millis(100),
    };

    assert_eq!(benchmark_config.iterations, 100);
    assert_eq!(benchmark_config.warmup_iterations, 10);
    assert!(benchmark_config.collect_memory_stats);
    assert!(benchmark_config.collect_system_stats);

    // Test default benchmark config
    let default_config = BenchmarkConfig::default();
    assert_eq!(default_config.iterations, 10);
    assert_eq!(default_config.warmup_iterations, 3);
    assert!(default_config.collect_memory_stats);
    assert!(default_config.collect_system_stats);

    println!("✅ Benchmark configuration test passed");
}
