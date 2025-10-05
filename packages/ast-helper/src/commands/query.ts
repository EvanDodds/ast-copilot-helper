/**
 * Query Command Implementation
 *
 * Functional semantic query system that uses the existing vector database infrastructure
 * to provide code search with similarity scores and ranking.
 */

import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import type { Config } from "../types.js";
import { VectorDatabaseFactory } from "../database/vector/factory.js";
import type {
  VectorDatabase,
  VectorDBConfig,
  SearchResult,
} from "../database/vector/types.js";
import { XenovaEmbeddingGenerator } from "../embedder/XenovaEmbeddingGenerator.js";

import { createLogger } from "../logging/index.js";

const logger = createLogger({ operation: "query" });

/**
 * Options for the query command
 */
export interface QueryOptions {
  /** Query text describing desired functionality */
  intent: string;
  /** Number of results to return (1-100) */
  top?: number;
  /** Minimum similarity score (0.0-1.0) */
  minScore?: number;
  /** Output format */
  format?: "plain" | "json" | "markdown";
  /** Workspace directory */
  workspace?: string;
  /** Config file path */
  config?: string;
}

/**
 * Formatted query result for display
 */
export interface QueryResult {
  /** Node identifier */
  nodeId: string;
  /** File path relative to workspace */
  filePath: string;
  /** Line number in file */
  lineNumber: number;
  /** Function/class signature */
  signature: string;
  /** Brief summary */
  summary: string;
  /** Similarity score (0-1) */
  score: number;
  /** Optional: code snippet */
  codeSnippet?: string;
}

/**
 * Query command handler that implements semantic code search
 */
export class QueryCommandHandler {
  private vectorDB: VectorDatabase | null = null;
  private embeddingGenerator: XenovaEmbeddingGenerator | null = null;

  /**
   * Execute the query command
   */
  async execute(options: QueryOptions, config: Config): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`Starting semantic query: "${options.intent}"`);

      // Initialize systems
      await this.initialize(config);

      // Generate embedding for query text
      const queryEmbedding = await this.generateQueryEmbedding(options.intent);

      // Search vector database
      const searchResults = await this.searchSimilar(
        queryEmbedding,
        options.top || 5,
        options.minScore || 0.0,
      );

      // Format results
      const formattedResults = await this.formatResults(searchResults, config);

      // Output results
      await this.outputResults(formattedResults, options.format || "plain");

      const totalTime = Date.now() - startTime;
      logger.info(
        `Query completed in ${totalTime}ms, returned ${formattedResults.length} results`,
      );
    } catch (error) {
      logger.error("Query execution failed:", { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize all required systems
   */
  private async initialize(config: Config): Promise<void> {
    const workspaceDir = process.cwd();
    const outputDir = config.outputDir || path.join(workspaceDir, ".astdb");

    // We don't need the database manager for queries

    // Check if vector database exists
    const vectorDbPath = path.join(outputDir, "vectors");
    const storageFile = path.join(vectorDbPath, "metadata.db");
    const indexFile = path.join(vectorDbPath, "index.bin");

    if (!existsSync(storageFile) || !existsSync(indexFile)) {
      throw new Error(
        `Vector database not found. Please run 'ast-helper embed' first to generate embeddings.\n` +
          `Expected files:\n` +
          `  - ${storageFile}\n` +
          `  - ${indexFile}`,
      );
    }

    // Configure vector database
    const vectorConfig: VectorDBConfig = {
      dimensions: 768, // CodeBERT dimensions
      maxElements: 100000,
      M: 16,
      efConstruction: 200,
      space: "cosine",
      storageFile,
      indexFile,
      autoSave: false, // Read-only for queries
      saveInterval: 0,
    };

    // Initialize vector database
    this.vectorDB = await VectorDatabaseFactory.create(vectorConfig, {
      verbose: false,
    });
    await this.vectorDB.initialize(vectorConfig);

    // Initialize embedding generator
    this.embeddingGenerator = new XenovaEmbeddingGenerator();
    const modelPath = path.join(outputDir, "models", "codebert");
    await this.embeddingGenerator.initialize(modelPath);

    logger.info("Query systems initialized successfully");
  }

  /**
   * Generate embedding vector for query text
   */
  private async generateQueryEmbedding(queryText: string): Promise<number[]> {
    if (!this.embeddingGenerator) {
      throw new Error("Embedding generator not initialized");
    }

    logger.debug(`Generating embedding for query: "${queryText}"`);

    const embeddings = await this.embeddingGenerator.generateEmbeddings([
      queryText,
    ]);

    if (embeddings.length === 0 || !embeddings[0]) {
      throw new Error("Failed to generate embedding for query");
    }

    return embeddings[0];
  }

  /**
   * Search for similar vectors in the database
   */
  private async searchSimilar(
    queryVector: number[],
    k: number,
    minScore: number,
  ): Promise<SearchResult[]> {
    if (!this.vectorDB) {
      throw new Error("Vector database not initialized");
    }

    logger.debug(
      `Searching for ${k} similar vectors with min score ${minScore}`,
    );

    // Search with slightly higher k to allow for filtering
    const searchK = Math.min(k * 2, 50);
    const results = await this.vectorDB.searchSimilar(queryVector, searchK);

    // Filter by minimum score and limit to requested number
    const filteredResults = results
      .filter((result) => result.score >= minScore)
      .slice(0, k);

    logger.debug(
      `Found ${results.length} raw results, ${filteredResults.length} after filtering`,
    );

    return filteredResults;
  }

  /**
   * Format search results for display
   */
  private async formatResults(
    searchResults: SearchResult[],
    _config: Config,
  ): Promise<QueryResult[]> {
    const workspaceDir = process.cwd();
    const results: QueryResult[] = [];

    for (const searchResult of searchResults) {
      // Get relative file path
      const absolutePath = searchResult.metadata.filePath;
      const relativePath = path.relative(workspaceDir, absolutePath);

      const queryResult: QueryResult = {
        nodeId: searchResult.nodeId,
        filePath: relativePath,
        lineNumber: searchResult.metadata.lineNumber,
        signature: searchResult.metadata.signature,
        summary: searchResult.metadata.summary,
        score: searchResult.score,
      };

      // Optionally add code snippet
      try {
        if (existsSync(absolutePath)) {
          const content = await fs.readFile(absolutePath, "utf-8");
          const lines = content.split("\n");
          const lineIndex = Math.max(0, searchResult.metadata.lineNumber - 1);

          // Extract a few lines around the target line for context
          const startLine = Math.max(0, lineIndex - 2);
          const endLine = Math.min(lines.length - 1, lineIndex + 3);

          queryResult.codeSnippet = lines
            .slice(startLine, endLine + 1)
            .map((line, idx) => {
              const lineNum = startLine + idx + 1;
              const marker =
                lineNum === searchResult.metadata.lineNumber ? "→" : " ";
              return `${marker} ${lineNum.toString().padStart(3)}: ${line}`;
            })
            .join("\n");
        }
      } catch (error) {
        logger.debug(`Failed to read code snippet from ${absolutePath}:`, {
          error,
        });
        // Continue without code snippet
      }

      results.push(queryResult);
    }

    return results;
  }

  /**
   * Output results in the specified format
   */
  private async outputResults(
    results: QueryResult[],
    format: string,
  ): Promise<void> {
    if (results.length === 0) {
      // eslint-disable-next-line no-console
      console.log("No results found matching your query.");
      return;
    }

    switch (format) {
      case "json":
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(results, null, 2));
        break;

      case "markdown":
        this.outputMarkdown(results);
        break;

      case "plain":
      default:
        this.outputPlain(results);
        break;
    }
  }

  /**
   * Output results in plain text format
   */
  private outputPlain(results: QueryResult[]): void {
    // eslint-disable-next-line no-console
    console.log(`\nFound ${results.length} matching results:\n`);

    results.forEach((result, index) => {
      // eslint-disable-next-line no-console
      console.log(`${index + 1}. ${result.signature}`);
      // eslint-disable-next-line no-console
      console.log(`   File: ${result.filePath}:${result.lineNumber}`);
      // eslint-disable-next-line no-console
      console.log(`   Score: ${result.score.toFixed(3)}`);
      if (result.summary !== result.signature) {
        // eslint-disable-next-line no-console
        console.log(`   Summary: ${result.summary}`);
      }

      if (result.codeSnippet) {
        // eslint-disable-next-line no-console
        console.log(`   Context:`);
        // eslint-disable-next-line no-console
        console.log(
          result.codeSnippet
            .split("\n")
            .map((line) => `     ${line}`)
            .join("\n"),
        );
      }

      // eslint-disable-next-line no-console
      console.log(); // Empty line between results
    });
  }

  /**
   * Output results in markdown format
   */
  private outputMarkdown(results: QueryResult[]): void {
    // eslint-disable-next-line no-console
    console.log(`# Query Results (${results.length} found)\n`);

    results.forEach((result, index) => {
      // eslint-disable-next-line no-console
      console.log(`## ${index + 1}. \`${result.signature}\``);
      // eslint-disable-next-line no-console
      console.log(`**File:** \`${result.filePath}:${result.lineNumber}\``);
      // eslint-disable-next-line no-console
      console.log(`**Score:** ${result.score.toFixed(3)}`);

      if (result.summary !== result.signature) {
        // eslint-disable-next-line no-console
        console.log(`**Summary:** ${result.summary}`);
      }

      if (result.codeSnippet) {
        // eslint-disable-next-line no-console
        console.log(`\n**Context:**`);
        // eslint-disable-next-line no-console
        console.log("```");
        // eslint-disable-next-line no-console
        console.log(result.codeSnippet);
        // eslint-disable-next-line no-console
        console.log("```");
      }

      // eslint-disable-next-line no-console
      console.log(); // Empty line between results
    });
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.vectorDB) {
        await this.vectorDB.shutdown();
        this.vectorDB = null;
      }

      if (this.embeddingGenerator) {
        // Note: XenovaEmbeddingGenerator might not have explicit cleanup
        this.embeddingGenerator = null;
      }
    } catch (error) {
      logger.debug("Error during cleanup:", { error });
      // Don't throw, as this is cleanup
    }
  }
}
