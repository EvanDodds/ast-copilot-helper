// TypeScript definitions for ast-core-engine

export interface HnswConfig {
  embeddingDimension: number;
  maxElements: number;
  m: number;
  efConstruction: number;
  efSearch: number;
}

export interface VectorDbConfig {
  embeddingDimension: number;
  maxElements?: number;
  m?: number;
  efConstruction?: number;
  efSearch?: number;
}

export interface SearchResult {
  node_id: string;
  distance: number;
  metadata?: any;
}

export interface VectorSearchResult {
  node_id: string;
  distance: number;
  metadata?: any;
}

export interface VectorMetadata {
  file_path?: string;
  node_type?: string;
  line_number?: number;
  [key: string]: any;
}

export interface NodeMetadata {
  filePath?: string;
  nodeType?: string;
  lineNumber?: number;
  columnNumber?: number;
  [key: string]: any;
}

export interface ProcessingError {
  message: string;
  errorType?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export interface BatchResult {
  processedFiles: number;
  totalNodes: number;
  processingTimeMs: number;
  errors: ProcessingError[];
  memoryPeakMb?: number;
}

export class AstCoreEngineApi {
  constructor();
  initialize(): Promise<void>;
  processBatch(files: string[], options?: any): Promise<BatchResult>;
  
  // Additional methods found in the API
  cancelBatch(): void;
  endTimer(): void;
  getBatchProgress(): any;
  getHealth(): any;
  getMemoryUsage(): any;
  getMetadata(): any;
  getMetrics(): any;
  processFile(file: string): Promise<any>;
  runBenchmark(): any;
  searchSimilar(queryText: string, maxResults: number): Promise<any>;
  startTimer(): void;
  storeMetadata(): void;
}

export function createHnswConfig(dimension: number, maxElements?: number, m?: number, efConstruction?: number, efSearch?: number): HnswConfig;
export function createEngineWithConfig(config: any): AstCoreEngineApi;
export function createDefaultEngine(): AstCoreEngineApi;
export function loadConfig(configPath: string): any;
export function initVectorDatabase(config: HnswConfig | VectorDbConfig): string;
export function addVectorToDb(nodeId: string, embeddingJson: string, metadata?: VectorMetadata): string;
export function searchVectors(queryEmbeddingJson: string, k: number): VectorSearchResult[];
export function getVectorCount(): number;
export function clearVectorDatabase(): string;
export function initEngine(): void;
export function getEngineVersion(): string;
export function healthCheck(): boolean;

export { AstCoreEngineApi };

declare const _default: () => any;
export default _default;
