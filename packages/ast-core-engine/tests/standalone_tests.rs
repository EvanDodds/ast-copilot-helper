//! Standalone unit tests for the AST Core Engine
//!
//! These tests validate the core Rust functionality without requiring
//! NAPI bindings or Node.js runtime environment.

use std::sync::Arc;

/// Test engine configuration creation and default values
#[tokio::test]
async fn test_engine_config_creation() {
    println!("🧪 Testing engine config creation...");

    let config = ast_helper_core_engine::config::EngineConfig::default();

    assert_eq!(config.hnsw_config.embedding_dimension, 384);
    assert_eq!(config.storage_config.db_path, ".astdb/index.db");
    assert!(config.storage_config.enable_wal);
    assert_eq!(config.max_memory_mb, 1024);

    println!("✅ Engine config test passed");
}

/// Test AST processor creation with different depths
#[tokio::test]
async fn test_ast_processor_creation() {
    println!("🧪 Testing AST processor creation...");

    let _processor = ast_helper_core_engine::ast_processor::AstProcessor::new(4); // max depth 4

    // Test processor creation succeeds
    println!("AST processor created successfully");

    println!("✅ AST processor test passed");
}

/// Test storage layer configuration and creation
#[tokio::test]
async fn test_storage_layer_creation() {
    println!("🧪 Testing storage layer creation...");

    let config = ast_helper_core_engine::config::StorageConfig::default();

    // Test that we can create storage layer async
    let storage_result = ast_helper_core_engine::storage::StorageLayer::new(config).await;
    assert!(
        storage_result.is_ok(),
        "Should create storage layer successfully"
    );

    println!("✅ Storage layer test passed");
}

/// Test vector database creation and operations
#[tokio::test]
async fn test_vector_database_creation() {
    println!("🧪 Testing vector database...");

    let config = ast_helper_core_engine::config::HnswConfig {
        embedding_dimension: 3, // Use small dimension for testing
        m: 16,
        ef_construction: 200,
        ef_search: 100,
        max_elements: 10000,
    };

    let mut vector_db = ast_helper_core_engine::vector_db::SimpleVectorDb::new(config);

    // Test initialization
    let result = vector_db.initialize();
    assert!(
        result.is_ok(),
        "Should initialize vector database successfully"
    );

    // Test vector operations with matching dimension
    let embedding = vec![0.1, 0.2, 0.3]; // Match the embedding dimension
    let metadata = ast_helper_core_engine::types::VectorMetadata {
        node_id: "test_node".to_string(),
        file_path: "test.ts".to_string(),
        node_type: "function".to_string(),
        signature: "test_function()".to_string(),
        language: "typescript".to_string(),
        embedding_model: "test_model".to_string(),
        timestamp: 0,
    };

    let result = vector_db.add_vector("test_node".to_string(), embedding, metadata);
    assert!(result.is_ok(), "Should add vector successfully");

    // Test search
    let query_embedding = vec![0.1, 0.2, 0.3];
    let results = vector_db.search_similar(query_embedding, 1, None);
    assert!(results.is_ok(), "Should search vectors successfully");

    let search_results = results.unwrap();
    assert_eq!(search_results.len(), 1, "Should find one similar vector");
    assert_eq!(
        search_results[0].node_id, "test_node",
        "Should find the correct node"
    );

    println!("✅ Vector database test passed");
}

/// Test performance monitor creation and basic operations
#[tokio::test]
async fn test_performance_monitor() {
    println!("🧪 Testing performance monitor...");

    let monitor = ast_helper_core_engine::performance_monitor::PerformanceMonitor::new();

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

    let storage_config = ast_helper_core_engine::config::StorageConfig::default();
    let batch_config = ast_helper_core_engine::batch_processor::BatchConfig::default();

    // Create necessary components
    let ast_processor = Arc::new(ast_helper_core_engine::ast_processor::AstProcessor::new(4));
    let storage_layer = Arc::new(
        ast_helper_core_engine::storage::StorageLayer::new(storage_config)
            .await
            .unwrap(),
    );

    // Create batch processor with required arguments
    let processor = ast_helper_core_engine::batch_processor::BatchProcessor::new(
        ast_processor,
        storage_layer,
        batch_config,
    );

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

    let config = ast_helper_core_engine::config::EngineConfig::default();
    let engine = ast_helper_core_engine::core::ASTCoreEngine::new(config);
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
    let vector_error =
        ast_helper_core_engine::error::EngineError::VectorDbError("Test vector error".to_string());
    assert!(matches!(
        vector_error,
        ast_helper_core_engine::error::EngineError::VectorDbError(_)
    ));

    let config_error =
        ast_helper_core_engine::error::EngineError::Configuration("Test config error".to_string());
    assert!(matches!(
        config_error,
        ast_helper_core_engine::error::EngineError::Configuration(_)
    ));

    // Test error display
    let error_message = format!("{}", vector_error);
    assert!(error_message.contains("Test vector error"));

    println!("✅ Error handling test passed");
}

/// Test processing options and configurations
#[tokio::test]
async fn test_processing_options() {
    println!("🧪 Testing processing options...");

    let options = ast_helper_core_engine::types::ProcessingOptions {
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
    let default_options = ast_helper_core_engine::types::ProcessingOptions::default();
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

    let benchmark_config = ast_helper_core_engine::performance_monitor::BenchmarkConfig {
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
    let default_config = ast_helper_core_engine::performance_monitor::BenchmarkConfig::default();
    assert_eq!(default_config.iterations, 10);
    assert_eq!(default_config.warmup_iterations, 3);
    assert!(default_config.collect_memory_stats);
    assert!(default_config.collect_system_stats);

    println!("✅ Benchmark configuration test passed");
}
