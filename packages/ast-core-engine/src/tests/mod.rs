//! Basic tests for workspace setup

use crate::{*, core::ASTCoreEngine, storage::StorageLayer};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_version() {
        let version = get_engine_version();
        assert!(version.starts_with("ast-core-engine"));
    }

    #[test]
    fn test_config_default() {
        let config = EngineConfig::default();
        assert_eq!(config.max_memory_mb, 1024);
        assert_eq!(config.parallel_workers, 4);
        assert_eq!(config.batch_size, 100);
        assert_eq!(config.vector_dimensions, 768);
    }

    #[test]
    fn test_load_config() {
        let config = load_config();
        assert!(config.max_memory_mb > 0);
        assert!(config.parallel_workers > 0);
    }

    #[tokio::test]
    async fn test_health_check() {
        let health = health_check().await.unwrap();
        assert_eq!(health.status, "healthy");
        // memory_usage_mb is u32, so it's always non-negative by type
        assert!(health.version.contains("ast-core-engine"));
    }

    #[test]
    fn test_processing_options_default() {
        let options = ProcessingOptions::default();
        assert_eq!(options.max_memory_mb, 1024);
        assert_eq!(options.batch_size, 100);
        assert_eq!(options.parallel_workers, 4);
    }

    #[test]
    fn test_engine_creation() {
        let config = EngineConfig::default();
        let engine = ASTCoreEngine::new(config);
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_storage_layer_creation() {
        use tempfile::tempdir;
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let mut storage_config = StorageConfig::default();
        storage_config.db_path = db_path.to_string_lossy().to_string();

        let storage = StorageLayer::new(storage_config).await;
        assert!(storage.is_ok());

        let storage = storage.unwrap();
        storage.close().await;
    }
}
