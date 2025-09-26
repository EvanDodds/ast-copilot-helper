# AST Core Engine

High-performance Rust core engine for AST processing, vector operations, and batch file handling.

## Features

- **Vector Database**: HNSW-based high-performance vector search
- **AST Processing**: Zero-copy Tree-sitter integration with parallel processing
- **Batch Processing**: Memory-efficient processing of 5000+ files
- **Storage Layer**: Async I/O optimized SQLite backend
- **Cross-Platform**: Native compilation for Windows, macOS, and Linux

## Installation

```bash
npm install @ast-helper/core-engine
```

## Usage

```typescript
import { initEngine, ASTCoreEngine } from "@ast-helper/core-engine";

// Initialize the engine
await initEngine();

// Create engine instance
const engine = new ASTCoreEngine({
  maxMemoryMb: 1024,
  parallelWorkers: 4,
  batchSize: 100,
  vectorDimensions: 768,
});

// Process files
const result = await engine.processBatch(files);
console.log(
  `Processed ${result.processedFiles} files in ${result.processingTimeMs}ms`,
);
```

## Building

### Prerequisites

- Rust (latest stable)
- Node.js >= 16
- Platform-specific build tools

### Development Build

```bash
npm run build:debug
```

### Release Build

```bash
npm run build
```

### Testing

```bash
cargo test
```

## Performance Targets

- Vector search: <50ms for 100k+ vectors
- Batch processing: 5000+ files without memory throttling
- Memory usage: 50-70% reduction vs TypeScript implementation
- AST parsing: 2-5x faster with zero-copy optimizations

## Architecture

The engine uses a hybrid architecture:

- **Rust Core**: Performance-critical computations
- **TypeScript Interface**: User-facing APIs and orchestration
- **NAPI-RS Bindings**: Zero-overhead Node.js integration

## License

MIT
