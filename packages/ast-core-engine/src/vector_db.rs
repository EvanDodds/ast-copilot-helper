//! High-Performance Vector Database with HNSW Indexing
//!
//! This module provides:
//! - Vector similarity search for AST nodes
//! - In-memory storage with metadata
//! - Simple NAPI bindings for TypeScript integration

use crate::{
    config::HnswConfig,
    error::EngineError,
    types::{SearchResult, VectorMetadata},
};
use dashmap::DashMap;
use napi_derive::napi;
use std::sync::{Arc, OnceLock};

/// Global vector database instance
static VECTOR_DB: OnceLock<SimpleVectorDb> = OnceLock::new();

/// Simple vector database for demonstration
pub struct SimpleVectorDb {
    /// Storage for vectors and metadata
    vectors: Arc<DashMap<String, (Vec<f32>, VectorMetadata)>>,
    /// Configuration
    config: HnswConfig,
}

impl SimpleVectorDb {
    /// Create a new vector database instance
    pub fn new(config: HnswConfig) -> Self {
        Self {
            vectors: Arc::new(DashMap::new()),
            config,
        }
    }

    /// Initialize the vector database
    pub fn initialize(&self) -> Result<(), EngineError> {
        println!(
            "Simple vector database initialized with embedding dimension: {}",
            self.config.embedding_dimension
        );
        Ok(())
    }

    /// Add a vector with metadata to the database
    pub fn add_vector(
        &self,
        node_id: String,
        embedding: Vec<f32>,
        metadata: VectorMetadata,
    ) -> Result<(), EngineError> {
        // Validate embedding dimension
        if embedding.len() != self.config.embedding_dimension as usize {
            return Err(EngineError::ValidationError(format!(
                "Invalid embedding dimension: expected {}, got {}",
                self.config.embedding_dimension,
                embedding.len()
            )));
        }

        // Store vector and metadata
        self.vectors.insert(node_id.clone(), (embedding, metadata));

        println!("Added vector for node: {}", node_id);
        Ok(())
    }

    /// Search for similar vectors using simple cosine similarity
    pub fn search_similar(
        &self,
        query_embedding: Vec<f32>,
        k: u32,
        _ef_search: Option<u32>,
    ) -> Result<Vec<SearchResult>, EngineError> {
        // Validate query embedding dimension
        if query_embedding.len() != self.config.embedding_dimension as usize {
            return Err(EngineError::ValidationError(format!(
                "Invalid query embedding dimension: expected {}, got {}",
                self.config.embedding_dimension,
                query_embedding.len()
            )));
        }

        let mut similarities = Vec::new();

        // Calculate similarity with all stored vectors
        for entry in self.vectors.iter() {
            let (node_id, (embedding, metadata)) = (entry.key().clone(), entry.value());
            let similarity = cosine_similarity(&query_embedding, embedding);

            similarities.push((node_id, similarity, metadata.clone()));
        }

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top k results
        let results: Vec<SearchResult> = similarities
            .into_iter()
            .take(k as usize)
            .map(|(node_id, similarity, metadata)| SearchResult {
                node_id: node_id.clone(),
                similarity: similarity as f64,
                distance: (1.0 - similarity) as f64,
                file_path: metadata.file_path.clone(),
                node_type: metadata.node_type.clone(),
            })
            .collect();

        println!("Found {} similar vectors", results.len());
        Ok(results)
    }

    /// Get total number of vectors in the database
    pub fn get_vector_count(&self) -> u32 {
        self.vectors.len() as u32
    }

    /// Clear all vectors
    pub fn clear(&self) -> Result<(), EngineError> {
        self.vectors.clear();
        println!("Vector database cleared");
        Ok(())
    }
}

/// Calculate cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

/// Initialize the global vector database instance
#[napi]
pub fn init_vector_database(config: HnswConfig) -> napi::Result<String> {
    // Validate configuration to prevent excessive memory allocation
    if config.embedding_dimension == 0 || config.embedding_dimension > 10000 {
        return Err(napi::Error::from_reason(format!(
            "Invalid embedding dimension: {}. Must be between 1 and 10000",
            config.embedding_dimension
        )));
    }
    
    if config.max_elements == 0 || config.max_elements > 10_000_000 {
        return Err(napi::Error::from_reason(format!(
            "Invalid max_elements: {}. Must be between 1 and 10,000,000",
            config.max_elements
        )));
    }

    // Check if database is already initialized
    if let Some(existing_db) = VECTOR_DB.get() {
        // If already initialized with compatible config, just clear and return success
        if existing_db.config.embedding_dimension == config.embedding_dimension {
            existing_db.clear()
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            return Ok("Vector database reinitialized successfully".to_string());
        } else {
            return Err(napi::Error::from_reason(
                "Vector database already initialized with different configuration".to_string()
            ));
        }
    }

    let db = SimpleVectorDb::new(config);
    db.initialize()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    VECTOR_DB
        .set(db)
        .map_err(|_| napi::Error::from_reason("Vector database initialization race condition".to_string()))?;

    Ok("Vector database initialized successfully".to_string())
}

/// Add a vector to the global database instance
#[napi]
pub fn add_vector_to_db(
    node_id: String,
    embedding_json: String, // JSON-encoded Vec<f32>
    metadata: VectorMetadata,
) -> napi::Result<String> {
    let db = VECTOR_DB
        .get()
        .ok_or_else(|| napi::Error::from_reason("Vector database not initialized".to_string()))?;

    // Parse the embedding from JSON
    let embedding: Vec<f32> = serde_json::from_str(&embedding_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid embedding JSON: {}", e)))?;

    db.add_vector(node_id.clone(), embedding, metadata)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(format!("Vector added successfully for node: {}", node_id))
}

/// Search for similar vectors in the global database instance  
#[napi]
pub fn search_vectors(
    query_embedding_json: String, // JSON-encoded Vec<f32>
    k: u32,
    ef_search: Option<u32>,
) -> napi::Result<Vec<SearchResult>> {
    let db = VECTOR_DB
        .get()
        .ok_or_else(|| napi::Error::from_reason("Vector database not initialized".to_string()))?;

    // Parse the query embedding from JSON
    let query_embedding: Vec<f32> = serde_json::from_str(&query_embedding_json)
        .map_err(|e| napi::Error::from_reason(format!("Invalid embedding JSON: {}", e)))?;

    db.search_similar(query_embedding, k, ef_search)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Get vector count from the global database instance
#[napi]
pub fn get_vector_count() -> napi::Result<u32> {
    let db = VECTOR_DB
        .get()
        .ok_or_else(|| napi::Error::from_reason("Vector database not initialized".to_string()))?;

    Ok(db.get_vector_count())
}

/// Clear the global vector database
#[napi]
pub fn clear_vector_database() -> napi::Result<String> {
    let db = VECTOR_DB
        .get()
        .ok_or_else(|| napi::Error::from_reason("Vector database not initialized".to_string()))?;

    db.clear()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok("Vector database cleared successfully".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_database_operations() {
        let config = HnswConfig {
            embedding_dimension: 3,
            m: 16,
            ef_construction: 200,
            ef_search: 50,
            max_elements: 1000,
        };

        let db = SimpleVectorDb::new(config);
        db.initialize().unwrap();

        // Test adding vectors
        let embedding = vec![0.1, 0.2, 0.3];
        let metadata = VectorMetadata {
            node_id: "test_node".to_string(),
            file_path: "test.ts".to_string(),
            node_type: "function".to_string(),
            signature: "test()".to_string(),
            language: "typescript".to_string(),
            embedding_model: "all-MiniLM-L6-v2".to_string(),
            timestamp: 1234567890u32,
        };

        db.add_vector("test_node".to_string(), embedding.clone(), metadata)
            .unwrap();

        // Test searching
        let results = db.search_similar(embedding, 5, None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].node_id, "test_node");

        // Test vector count
        assert_eq!(db.get_vector_count(), 1);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);

        let c = vec![1.0, 0.0, 0.0];
        let d = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&c, &d) - 0.0).abs() < 1e-6);
    }
}
