/**
 * Mock Vector Database for Query Testing
 * 
 * This creates minimal test data to demonstrate the query system functionality
 * without requiring the full embedding pipeline.
 */

import * as fs from "fs/promises";
import * as path from "path";

async function createMockVectorDatabase() {
  const baseDir = "/home/evan/ast-copilot-helper/.astdb";
  const vectorsDir = path.join(baseDir, "vectors");
  
  // Create vectors directory
  await fs.mkdir(vectorsDir, { recursive: true });
  
  // Create mock metadata.db (SQLite would be binary, but we'll create a placeholder)
  const metadataFile = path.join(vectorsDir, "metadata.db");
  await fs.writeFile(metadataFile, "Mock SQLite database for testing");
  
  // Create mock index.bin (HNSW index would be binary, but we'll create a placeholder)
  const indexFile = path.join(vectorsDir, "index.bin");
  await fs.writeFile(indexFile, "Mock HNSW index for testing");
  
  console.log("✅ Mock vector database files created:");
  console.log(`   - ${metadataFile}`);
  console.log(`   - ${indexFile}`);
  console.log("\nNote: These are placeholder files. Real vector database would be created by 'ast-helper embed'");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createMockVectorDatabase().catch(console.error);
}

export { createMockVectorDatabase };