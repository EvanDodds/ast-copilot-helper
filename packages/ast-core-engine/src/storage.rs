//! High-performance async storage layer with SQLite backend

#[cfg(feature = "full-system")]
use {
    crate::config::StorageConfig,
    crate::error::{EngineError, StorageError},
    crate::types::NodeMetadata,
    dashmap::DashMap,
    serde::{Deserialize, Serialize},
    sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        Pool, Row, Sqlite,
    },
    std::path::Path,
    std::sync::Arc,
    std::time::{SystemTime, UNIX_EPOCH},
    tokio::sync::RwLock,
};

#[cfg(any(feature = "wasm", test))]
use crate::ast_processor::{AstNode, SupportedLanguage};

#[cfg(feature = "full-system")]
pub mod storage_impl {
    use super::*;

    /// File metadata stored in database
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct FileRecord {
        pub id: i64,
        pub file_path: String,
        pub language: String,
        pub content_hash: String,
        pub ast_node_count: i64,
        pub processing_time_ms: i64,
        pub created_at: i64,
        pub updated_at: i64,
    }

    /// AST node stored in database
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct NodeRecord {
        pub id: i64,
        pub file_id: i64,
        pub node_type: String,
        pub start_byte: i64,
        pub end_byte: i64,
        pub start_row: i64,
        pub end_row: i64,
        pub start_column: i64,
        pub end_column: i64,
        pub text_content: String,
        pub parent_id: Option<i64>,
        pub is_named: bool,
        pub created_at: i64,
    }

    /// Vector embedding stored in database
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct VectorRecord {
        pub id: i64,
        pub node_id: i64,
        pub vector_data: String, // JSON-encoded vector
        pub model_name: String,
        pub dimensions: i64,
        pub created_at: i64,
    }

    /// In-memory cache for frequently accessed data
    #[derive(Debug)]
    pub struct StorageCache {
        file_records: DashMap<String, FileRecord>, // path -> record
        node_records: DashMap<i64, NodeRecord>,    // node_id -> record
        vector_records: DashMap<i64, VectorRecord>, // node_id -> vector
        max_size: usize,
    }

    impl StorageCache {
        pub fn new(max_size: usize) -> Self {
            Self {
                file_records: DashMap::new(),
                node_records: DashMap::new(),
                vector_records: DashMap::new(),
                max_size,
            }
        }

        pub fn get_file(&self, path: &str) -> Option<FileRecord> {
            self.file_records.get(path).map(|entry| entry.clone())
        }

        pub fn cache_file(&self, path: String, record: FileRecord) {
            if self.file_records.len() < self.max_size {
                self.file_records.insert(path, record);
            }
        }

        pub fn get_node(&self, node_id: i64) -> Option<NodeRecord> {
            self.node_records.get(&node_id).map(|entry| entry.clone())
        }

        pub fn cache_node(&self, node_id: i64, record: NodeRecord) {
            if self.node_records.len() < self.max_size {
                self.node_records.insert(node_id, record);
            }
        }

        pub fn clear(&self) {
            self.file_records.clear();
            self.node_records.clear();
            self.vector_records.clear();
        }

        pub fn cache_stats(&self) -> CacheStats {
            CacheStats {
                file_count: self.file_records.len(),
                node_count: self.node_records.len(),
                vector_count: self.vector_records.len(),
                max_size: self.max_size,
            }
        }
    }

    /// Cache statistics for monitoring
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CacheStats {
        pub file_count: usize,
        pub node_count: usize,
        pub vector_count: usize,
        pub max_size: usize,
    }

    /// High-performance async storage layer
    pub struct StorageLayer {
        pool: Pool<Sqlite>,
        cache: Arc<RwLock<StorageCache>>,
        config: StorageConfig,
    }

    impl StorageLayer {
        /// Create new storage layer with connection pooling
        pub async fn new(config: StorageConfig) -> Result<Self, EngineError> {
            // Ensure database directory exists
            let db_path = Path::new(&config.db_path);
            if let Some(parent) = db_path.parent() {
                tokio::fs::create_dir_all(parent).await?;
            }

            // Set up connection options
            let connect_options = SqliteConnectOptions::new()
                .filename(&config.db_path)
                .create_if_missing(true)
                .pragma("cache_size", format!("-{}", config.cache_size_mb * 1024)) // Negative for KB
                .pragma("synchronous", "NORMAL") // Use NORMAL for better performance
                .pragma("temp_store", "memory")
                .pragma("foreign_keys", "ON"); // Enable foreign key constraints

            let connect_options = if config.enable_wal {
                connect_options.pragma("journal_mode", "WAL")
            } else {
                connect_options.pragma("journal_mode", "DELETE") // Explicit journal mode
            };

            // Create connection pool
            let pool = SqlitePoolOptions::new()
                .max_connections(config.max_connections)
                .acquire_timeout(std::time::Duration::from_secs(
                    config.connection_timeout_secs as u64,
                ))
                .connect_with(connect_options)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Connection(e.to_string())))?;

            let cache = Arc::new(RwLock::new(StorageCache::new(
                config.cache_size_mb as usize * 100,
            )));

            let storage = Self {
                pool,
                cache,
                config,
            };

            // Initialize database schema
            storage.initialize_schema().await?;

            Ok(storage)
        }

        /// Get storage configuration
        pub fn config(&self) -> &StorageConfig {
            &self.config
        }

        /// Initialize database tables
        async fn initialize_schema(&self) -> Result<(), EngineError> {
            let queries = vec![
                // Files table
                r#"
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                language TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                ast_node_count INTEGER NOT NULL DEFAULT 0,
                processing_time_ms INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
                // AST nodes table
                r#"
            CREATE TABLE IF NOT EXISTS ast_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                node_type TEXT NOT NULL,
                start_byte INTEGER NOT NULL,
                end_byte INTEGER NOT NULL,
                start_row INTEGER NOT NULL,
                end_row INTEGER NOT NULL,
                start_column INTEGER NOT NULL,
                end_column INTEGER NOT NULL,
                text_content TEXT NOT NULL,
                parent_id INTEGER,
                is_named BOOLEAN NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES ast_nodes (id) ON DELETE CASCADE
            )
            "#,
                // Vector embeddings table
                r#"
            CREATE TABLE IF NOT EXISTS vectors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id INTEGER UNIQUE NOT NULL,
                vector_data TEXT NOT NULL,
                model_name TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (node_id) REFERENCES ast_nodes (id) ON DELETE CASCADE
            )
            "#,
                // Node metadata table (for compatibility with existing types)
                r#"
            CREATE TABLE IF NOT EXISTS node_metadata (
                node_id TEXT PRIMARY KEY,
                metadata_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
                // Indexes for performance
                "CREATE INDEX IF NOT EXISTS idx_files_path ON files (file_path)",
                "CREATE INDEX IF NOT EXISTS idx_files_language ON files (language)",
                "CREATE INDEX IF NOT EXISTS idx_nodes_file_id ON ast_nodes (file_id)",
                "CREATE INDEX IF NOT EXISTS idx_nodes_type ON ast_nodes (node_type)",
                "CREATE INDEX IF NOT EXISTS idx_nodes_parent ON ast_nodes (parent_id)",
                "CREATE INDEX IF NOT EXISTS idx_vectors_node_id ON vectors (node_id)",
                "CREATE INDEX IF NOT EXISTS idx_vectors_model ON vectors (model_name)",
            ];

            for query in queries {
                sqlx::query(query).execute(&self.pool).await.map_err(|e| {
                    EngineError::Storage(StorageError::Migration(format!(
                        "Schema initialization failed: {}",
                        e
                    )))
                })?;
            }

            Ok(())
        }

        /// Store file record and return file ID
        #[cfg(any(feature = "wasm", test))]
        pub async fn store_file(
            &self,
            file_path: &str,
            language: SupportedLanguage,
            content_hash: &str,
            ast_node_count: u32,
            processing_time_ms: u32,
        ) -> Result<i64, EngineError> {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;

            let result = sqlx::query(
            r#"
            INSERT INTO files (file_path, language, content_hash, ast_node_count, processing_time_ms, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_path) DO UPDATE SET
                language = excluded.language,
                content_hash = excluded.content_hash,
                ast_node_count = excluded.ast_node_count,
                processing_time_ms = excluded.processing_time_ms,
                updated_at = excluded.updated_at
            "#
        )
        .bind(file_path)
        .bind(format!("{:?}", language))
        .bind(content_hash)
        .bind(ast_node_count as i64)
        .bind(processing_time_ms as i64)
        .bind(timestamp)
        .bind(timestamp)
        .execute(&self.pool)
        .await
        .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            // Get the file ID
            let file_id = if result.rows_affected() > 0 {
                result.last_insert_rowid()
            } else {
                // File was updated, get existing ID
                let row = sqlx::query("SELECT id FROM files WHERE file_path = ?")
                    .bind(file_path)
                    .fetch_one(&self.pool)
                    .await
                    .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;
                row.get::<i64, _>(0)
            };

            // Cache the file record
            let file_record = FileRecord {
                id: file_id,
                file_path: file_path.to_string(),
                language: format!("{:?}", language),
                content_hash: content_hash.to_string(),
                ast_node_count: ast_node_count as i64,
                processing_time_ms: processing_time_ms as i64,
                created_at: timestamp,
                updated_at: timestamp,
            };

            let cache = self.cache.write().await;
            cache.cache_file(file_path.to_string(), file_record);

            Ok(file_id)
        }

        /// Store AST nodes for a file
        #[cfg(any(feature = "wasm", test))]
        pub async fn store_ast_nodes(
            &self,
            file_id: i64,
            nodes: &[AstNode],
        ) -> Result<Vec<i64>, EngineError> {
            let mut tx = self
                .pool
                .begin()
                .await
                .map_err(|e| EngineError::Storage(StorageError::Transaction(e.to_string())))?;

            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let mut node_ids = Vec::new();

            for node in nodes {
                let result = sqlx::query(
                    r#"
                INSERT INTO ast_nodes (
                    file_id, node_type, start_byte, end_byte, start_row, end_row,
                    start_column, end_column, text_content, is_named, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
                )
                .bind(file_id)
                .bind(&node.node_type)
                .bind(node.start_byte as i64)
                .bind(node.end_byte as i64)
                .bind(node.start_row as i64)
                .bind(node.end_row as i64)
                .bind(node.start_column as i64)
                .bind(node.end_column as i64)
                .bind(&node.text)
                .bind(node.is_named)
                .bind(timestamp)
                .execute(&mut *tx)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

                node_ids.push(result.last_insert_rowid());
            }

            tx.commit()
                .await
                .map_err(|e| EngineError::Storage(StorageError::Transaction(e.to_string())))?;

            Ok(node_ids)
        }

        /// Store vector embedding for a node
        pub async fn store_vector(
            &self,
            node_id: i64,
            vector_data: &[f64],
            model_name: &str,
        ) -> Result<i64, EngineError> {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let vector_json =
                serde_json::to_string(vector_data).map_err(EngineError::Serialization)?;

            let result = sqlx::query(
                r#"
            INSERT INTO vectors (node_id, vector_data, model_name, dimensions, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(node_id) DO UPDATE SET
                vector_data = excluded.vector_data,
                model_name = excluded.model_name,
                dimensions = excluded.dimensions,
                created_at = excluded.created_at
            "#,
            )
            .bind(node_id)
            .bind(vector_json)
            .bind(model_name)
            .bind(vector_data.len() as i64)
            .bind(timestamp)
            .execute(&self.pool)
            .await
            .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            Ok(result.last_insert_rowid())
        }

        /// Store node metadata (compatible with existing API)
        pub async fn store_metadata(&self, metadata: &NodeMetadata) -> Result<(), StorageError> {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let metadata_json = serde_json::to_string(metadata)
                .map_err(|e| StorageError::Query(format!("Serialization failed: {}", e)))?;

            sqlx::query(
                r#"
            INSERT INTO node_metadata (node_id, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(node_id) DO UPDATE SET
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            "#,
            )
            .bind(&metadata.node_id)
            .bind(metadata_json)
            .bind(timestamp)
            .bind(timestamp)
            .execute(&self.pool)
            .await
            .map_err(|e| StorageError::Query(e.to_string()))?;

            Ok(())
        }

        /// Retrieve node metadata (compatible with existing API)
        pub async fn get_metadata(
            &self,
            node_id: &str,
        ) -> Result<Option<NodeMetadata>, StorageError> {
            let result = sqlx::query("SELECT metadata_json FROM node_metadata WHERE node_id = ?")
                .bind(node_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| StorageError::Query(e.to_string()))?;

            match result {
                Some(row) => {
                    let json: String = row.get(0);
                    let metadata = serde_json::from_str(&json).map_err(|e| {
                        StorageError::Query(format!("Deserialization failed: {}", e))
                    })?;
                    Ok(Some(metadata))
                }
                None => Ok(None),
            }
        }

        /// Get file record by path (with caching)
        pub async fn get_file(&self, file_path: &str) -> Result<Option<FileRecord>, EngineError> {
            // Check cache first
            {
                let cache = self.cache.read().await;
                if let Some(record) = cache.get_file(file_path) {
                    return Ok(Some(record));
                }
            }

            // Query database
            let row = sqlx::query("SELECT id, file_path, language, content_hash, ast_node_count, processing_time_ms, created_at, updated_at FROM files WHERE file_path = ?")
            .bind(file_path)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            let record = row.map(|r| FileRecord {
                id: r.get(0),
                file_path: r.get(1),
                language: r.get(2),
                content_hash: r.get(3),
                ast_node_count: r.get(4),
                processing_time_ms: r.get(5),
                created_at: r.get(6),
                updated_at: r.get(7),
            });

            // Cache the result if found
            if let Some(ref record) = record {
                let cache = self.cache.write().await;
                cache.cache_file(file_path.to_string(), record.clone());
            }

            Ok(record)
        }

        /// Get AST nodes for a file
        pub async fn get_ast_nodes(&self, file_id: i64) -> Result<Vec<NodeRecord>, EngineError> {
            let rows = sqlx::query(
                r#"
            SELECT id, file_id, node_type, start_byte, end_byte, start_row, end_row,
                   start_column, end_column, text_content, parent_id, is_named, created_at
            FROM ast_nodes 
            WHERE file_id = ? 
            ORDER BY start_byte
            "#,
            )
            .bind(file_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            let nodes: Vec<NodeRecord> = rows
                .into_iter()
                .map(|row| NodeRecord {
                    id: row.get(0),
                    file_id: row.get(1),
                    node_type: row.get(2),
                    start_byte: row.get(3),
                    end_byte: row.get(4),
                    start_row: row.get(5),
                    end_row: row.get(6),
                    start_column: row.get(7),
                    end_column: row.get(8),
                    text_content: row.get(9),
                    parent_id: row.get(10),
                    is_named: row.get(11),
                    created_at: row.get(12),
                })
                .collect();

            Ok(nodes)
        }

        /// Search nodes by type pattern
        pub async fn search_nodes_by_type(
            &self,
            type_pattern: &str,
            limit: u32,
        ) -> Result<Vec<NodeRecord>, EngineError> {
            let rows = sqlx::query(
                r#"
            SELECT id, file_id, node_type, start_byte, end_byte, start_row, end_row,
                   start_column, end_column, text_content, parent_id, is_named, created_at
            FROM ast_nodes 
            WHERE node_type LIKE ? 
            ORDER BY created_at DESC
            LIMIT ?
            "#,
            )
            .bind(type_pattern)
            .bind(limit as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            let nodes: Vec<NodeRecord> = rows
                .into_iter()
                .map(|row| NodeRecord {
                    id: row.get(0),
                    file_id: row.get(1),
                    node_type: row.get(2),
                    start_byte: row.get(3),
                    end_byte: row.get(4),
                    start_row: row.get(5),
                    end_row: row.get(6),
                    start_column: row.get(7),
                    end_column: row.get(8),
                    text_content: row.get(9),
                    parent_id: row.get(10),
                    is_named: row.get(11),
                    created_at: row.get(12),
                })
                .collect();

            Ok(nodes)
        }

        /// Delete file and all associated data
        pub async fn delete_file(&self, file_path: &str) -> Result<bool, EngineError> {
            let result = sqlx::query("DELETE FROM files WHERE file_path = ?")
                .bind(file_path)
                .execute(&self.pool)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;

            // Clear from cache
            {
                let cache = self.cache.read().await;
                cache.file_records.remove(file_path);
            }

            Ok(result.rows_affected() > 0)
        }

        /// Get storage statistics
        pub async fn get_storage_stats(&self) -> Result<StorageStats, EngineError> {
            let file_count_row = sqlx::query("SELECT COUNT(*) FROM files")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;
            let file_count: i64 = file_count_row.get(0);

            let node_count_row = sqlx::query("SELECT COUNT(*) FROM ast_nodes")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;
            let node_count: i64 = node_count_row.get(0);

            let vector_count_row = sqlx::query("SELECT COUNT(*) FROM vectors")
                .fetch_one(&self.pool)
                .await
                .map_err(|e| EngineError::Storage(StorageError::Query(e.to_string())))?;
            let vector_count: i64 = vector_count_row.get(0);

            let cache_stats = {
                let cache = self.cache.read().await;
                cache.cache_stats()
            };

            Ok(StorageStats {
                file_count: file_count as u64,
                node_count: node_count as u64,
                vector_count: vector_count as u64,
                cache_stats,
                connection_pool_size: self.pool.size(),
                max_connections: self.config.max_connections,
            })
        }

        /// Clear cache
        pub async fn clear_cache(&self) {
            let cache = self.cache.read().await;
            cache.clear();
        }

        /// Close storage layer
        pub async fn close(&self) {
            self.pool.close().await;
        }
    }

    /// Storage statistics for monitoring
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct StorageStats {
        pub file_count: u64,
        pub node_count: u64,
        pub vector_count: u64,
        pub cache_stats: CacheStats,
        pub connection_pool_size: u32,
        pub max_connections: u32,
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::ast_processor::AstNode;

        async fn create_test_storage() -> StorageLayer {
            let config = StorageConfig {
                db_path: ":memory:".to_string(), // Use in-memory database for tests
                max_connections: 1,              // Use single connection for tests
                connection_timeout_secs: 10,
                cache_size_mb: 16,
                enable_wal: false, // Disable WAL for tests
            };

            StorageLayer::new(config).await.unwrap()
        }

        #[tokio::test]
        async fn test_storage_creation() {
            let storage = create_test_storage().await;
            let stats = storage.get_storage_stats().await.unwrap();

            assert_eq!(stats.file_count, 0);
            assert_eq!(stats.node_count, 0);
            assert_eq!(stats.vector_count, 0);

            storage.close().await;
        }

        #[tokio::test]
        async fn test_file_operations() {
            let storage = create_test_storage().await;

            // Store a file
            let file_id = storage
                .store_file("test.js", SupportedLanguage::JavaScript, "hash123", 5, 150)
                .await
                .unwrap();

            assert!(file_id > 0);

            // Retrieve the file
            let file_record = storage.get_file("test.js").await.unwrap();
            assert!(file_record.is_some());

            let file = file_record.unwrap();
            assert_eq!(file.file_path, "test.js");
            assert_eq!(file.language, "JavaScript");
            assert_eq!(file.content_hash, "hash123");

            storage.close().await;
        }

        #[tokio::test]
        async fn test_ast_node_operations() {
            let storage = create_test_storage().await;

            // Store a file first
            let file_id = storage
                .store_file("test.js", SupportedLanguage::JavaScript, "hash123", 2, 100)
                .await
                .unwrap();

            // Create test AST nodes
            let nodes = vec![
                AstNode {
                    node_type: "function_declaration".to_string(),
                    start_byte: 0,
                    end_byte: 50,
                    start_row: 0,
                    end_row: 3,
                    start_column: 0,
                    end_column: 1,
                    text: "function test() {}".to_string(),
                    children_count: 3,
                    is_named: true,
                },
                AstNode {
                    node_type: "identifier".to_string(),
                    start_byte: 9,
                    end_byte: 13,
                    start_row: 0,
                    end_row: 0,
                    start_column: 9,
                    end_column: 13,
                    text: "test".to_string(),
                    children_count: 0,
                    is_named: true,
                },
            ];

            // Store AST nodes
            let node_ids = storage.store_ast_nodes(file_id, &nodes).await.unwrap();
            assert_eq!(node_ids.len(), 2);

            // Retrieve AST nodes
            let stored_nodes = storage.get_ast_nodes(file_id).await.unwrap();
            assert_eq!(stored_nodes.len(), 2);
            assert_eq!(stored_nodes[0].node_type, "function_declaration");
            assert_eq!(stored_nodes[1].node_type, "identifier");

            storage.close().await;
        }

        #[tokio::test]
        async fn test_vector_operations() {
            let storage = create_test_storage().await;

            // Store file and nodes first
            let file_id = storage
                .store_file("test.js", SupportedLanguage::JavaScript, "hash123", 1, 100)
                .await
                .unwrap();

            let nodes = vec![AstNode {
                node_type: "identifier".to_string(),
                start_byte: 0,
                end_byte: 4,
                start_row: 0,
                end_row: 0,
                start_column: 0,
                end_column: 4,
                text: "test".to_string(),
                children_count: 0,
                is_named: true,
            }];

            let node_ids = storage.store_ast_nodes(file_id, &nodes).await.unwrap();
            let node_id = node_ids[0];

            // Store vector
            let vector = vec![0.1, 0.2, 0.3, 0.4, 0.5];
            let vector_id = storage
                .store_vector(node_id, &vector, "test_model")
                .await
                .unwrap();
            assert!(vector_id > 0);

            // Verify storage stats
            let stats = storage.get_storage_stats().await.unwrap();
            assert_eq!(stats.vector_count, 1);

            storage.close().await;
        }

        #[tokio::test]
        async fn test_search_operations() {
            let storage = create_test_storage().await;

            // Store file and multiple nodes
            let file_id = storage
                .store_file("test.js", SupportedLanguage::JavaScript, "hash123", 3, 100)
                .await
                .unwrap();

            let nodes = vec![
                AstNode {
                    node_type: "function_declaration".to_string(),
                    start_byte: 0,
                    end_byte: 50,
                    start_row: 0,
                    end_row: 3,
                    start_column: 0,
                    end_column: 1,
                    text: "function test1() {}".to_string(),
                    children_count: 3,
                    is_named: true,
                },
                AstNode {
                    node_type: "function_declaration".to_string(),
                    start_byte: 51,
                    end_byte: 101,
                    start_row: 4,
                    end_row: 7,
                    start_column: 0,
                    end_column: 1,
                    text: "function test2() {}".to_string(),
                    children_count: 3,
                    is_named: true,
                },
                AstNode {
                    node_type: "variable_declaration".to_string(),
                    start_byte: 102,
                    end_byte: 120,
                    start_row: 8,
                    end_row: 8,
                    start_column: 0,
                    end_column: 18,
                    text: "var x = 42;".to_string(),
                    children_count: 2,
                    is_named: true,
                },
            ];

            storage.store_ast_nodes(file_id, &nodes).await.unwrap();

            // Search for function declarations
            let function_nodes = storage
                .search_nodes_by_type("function_%", 10)
                .await
                .unwrap();
            assert_eq!(function_nodes.len(), 2);

            // Search for variable declarations
            let variable_nodes = storage
                .search_nodes_by_type("variable_%", 10)
                .await
                .unwrap();
            assert_eq!(variable_nodes.len(), 1);

            storage.close().await;
        }

        #[tokio::test]
        async fn test_cache_operations() {
            let storage = create_test_storage().await;

            // Store a file
            storage
                .store_file(
                    "cached_test.js",
                    SupportedLanguage::JavaScript,
                    "hash456",
                    1,
                    50,
                )
                .await
                .unwrap();

            // First access - should load from database
            let file1 = storage.get_file("cached_test.js").await.unwrap();
            assert!(file1.is_some());

            // Second access - should load from cache
            let file2 = storage.get_file("cached_test.js").await.unwrap();
            assert!(file2.is_some());
            assert_eq!(file1.unwrap().id, file2.unwrap().id);

            // Check cache stats
            let stats = storage.get_storage_stats().await.unwrap();
            assert_eq!(stats.cache_stats.file_count, 1);

            // Clear cache
            storage.clear_cache().await;
            let stats_after = storage.get_storage_stats().await.unwrap();
            assert_eq!(stats_after.cache_stats.file_count, 0);

            storage.close().await;
        }

        #[tokio::test]
        async fn test_node_metadata_compatibility() {
            let storage = create_test_storage().await;

            // Create mock node metadata to test compatibility with existing API
            let metadata = NodeMetadata {
                node_id: "test_node_123".to_string(),
                file_path: "test.js".to_string(),
                signature: "function test()".to_string(),
                summary: "A test function".to_string(),
                source_snippet: "function test() {}".to_string(),
                complexity: 1,
                language: "JavaScript".to_string(),
            };

            // Store metadata
            storage.store_metadata(&metadata).await.unwrap();

            // Retrieve metadata
            let retrieved = storage.get_metadata("test_node_123").await.unwrap();
            assert!(retrieved.is_some());

            let retrieved_metadata = retrieved.unwrap();
            assert_eq!(retrieved_metadata.node_id, "test_node_123");
            assert_eq!(retrieved_metadata.file_path, "test.js");
            assert_eq!(retrieved_metadata.signature, "function test()");

            storage.close().await;
        }

        #[tokio::test]
        async fn test_concurrent_operations() {
            let storage = Arc::new(create_test_storage().await);
            let mut handles = Vec::new();

            // Spawn multiple concurrent file storage operations
            for i in 0..10 {
                let storage_clone = Arc::clone(&storage);
                let handle = tokio::spawn(async move {
                    storage_clone
                        .store_file(
                            &format!("concurrent_test_{}.js", i),
                            SupportedLanguage::JavaScript,
                            &format!("hash_{}", i),
                            i + 1,
                            (i + 1) * 10,
                        )
                        .await
                });
                handles.push(handle);
            }

            // Wait for all operations to complete
            let results: Result<Vec<_>, _> = futures::future::try_join_all(handles).await;
            assert!(results.is_ok());

            // Verify all files were stored
            let stats = storage.get_storage_stats().await.unwrap();
            assert_eq!(stats.file_count, 10);

            storage.close().await;
        }
    }
} // end storage_impl module

#[cfg(feature = "full-system")]
pub use storage_impl::*;

// WASM stub implementation
#[cfg(not(feature = "full-system"))]
pub mod wasm_storage_stub {
    use crate::error::{EngineError, StorageError};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct FileRecord {
        pub id: i64,
        pub file_path: String,
        pub language: String,
        pub content_hash: String,
        pub ast_node_count: i64,
        pub processing_time_ms: i64,
        pub created_at: i64,
        pub updated_at: i64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct StorageStats {
        pub file_count: i64,
        pub node_count: i64,
        pub vector_count: i64,
    }

    pub struct StorageLayer;

    impl StorageLayer {
        pub async fn new(_config: crate::config::StorageConfig) -> Result<Self, StorageError> {
            Err(StorageError::NotSupported(
                "Storage not available in WASM".to_string(),
            ))
        }
    }
}

#[cfg(not(feature = "full-system"))]
pub use wasm_storage_stub::*;
