# Project Specification: ast-copilot-helper

## 1. Overview  

ast-copilot-helper is a self-contained, filesystem-only toolkit that continuously extracts, annotates, embeds, indexes, and retrieves AST fragments from your codebase. It ships as a single NPM package with a CLI (`ast-helper`) and an optional VS Code extension that intercepts Copilot prompts, prepending precisely the AST-derived context you need. There are no external services or databases—just files under `.astdb/`.  

This design dramatically cuts Copilot’s token usage, improves suggestion relevance, and slots seamlessly into existing git workflows and CI pipelines.  

---  

## 2. Design Decisions  

- **File-only datastore**  
  All data—raw ASTs, annotations, vector index—lives under `.astdb/`. No Docker, no remote DB, no long-running MCP server.  

- **Modular CLI**  
  One entrypoint (`ast-helper`) with subcommands (`parse`, `annotate`, `embed`, `query`, `watch`). Each subcommand can be invoked in isolation, in CI steps, or chained via git hooks.  

- **Local embeddings + vector search**  
  Leverage an embedded JS/Node embedding model (e.g. `@xenova/transformers`) and `hnswlib-node` (with a pure-JS fallback) to build and query a nearest-neighbor index on disk (`.astdb/index.*`).  

- **TypeScript implementation**  
  Provides strong types for AST schemas, annotation metadata, and index records. Distributes as a transpiled NPM module.  

- **Copilot prompt augmentation**  
  A lightweight VS Code extension intercepts Copilot Chat or “Ask Copilot” events, runs `ast-helper query`, and merges in the top-K AST snippets before sending to GitHub’s endpoint.  

---  

## 3. High-Level Architecture  

```txt
Your Repo/
├─ src/…                     # Your code
├─ .astdb/
│  ├─ asts/                  # raw AST JSON per file
│  ├─ annots/                # annotated metadata JSON per node
│  ├─ index.bin              # HNSW binary index
│  ├─ index.meta.json        # mapping from index IDs → file + node
│  └─ config.json            # user overrides (patterns, thresholds)
├─ node_modules/
├─ package.json
└─ .husky/                   # Git hooks for parse/annotate/embed
```

1. **parse** reads only git-changed files, emits normalized AST JSON under `asts/`.  
2. **annotate** consumes those ASTs, computes signatures, summaries, cyclomatic complexity, dependency lists, and writes to `annots/`.  
3. **embed** loads annotations, runs each summary+signature through the embedding model, upserts vectors into `index.*`.  
4. **query** embeds a natural-language intent, fetches top-K nearest neighbors, and returns the node summaries plus code snippets.  
5. **watch** runs `parse→annotate→embed` on file changes in real time.  
6. **VS Code Extension** intercepts Copilot commands, injects `query` results into the prompt.  

---  

## 4. Module Specifications  

### 4.1 CLI Entrypoint (`ast-helper`)  

- **Language**: TypeScript, compiled to JS.  
- **Dispatch**: uses [commander.js](https://github.com/tj/commander.js).  
- **Subcommands**:  
  - `parse [--changed] [--glob <pattern>]`  
  - `annotate [--changed]`  
  - `embed [--changed] [--model <path>]`  
  - `query --intent "<text>" [--top <N>]`  
  - `watch [--glob <pattern>]`  

**Configuration** lives in `.astdb/config.json`, merging CLI flags with defaults.

### 4.2 AST Extractor (parse)  

- **Parser**: [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) for polyglot support (TS/JS/Python initially).  
- **Runtime**: Prefer native `node-tree-sitter` with WASM fallback via `tree-sitter-wasm` for zero-dependency installs.  
- **Grammars**: Downloaded on demand to `.astdb/grammars/` with version pins; TS/JS/Python grammars cached locally.  
- **Input**: All files matching `config.parseGlob` or `--glob`, filtered by `git diff --name-only --diff-filter=ACMRT HEAD` (or `--staged`/`--base <ref>` overrides).  
- **Output**: One JSON file per source file under `.astdb/asts/`.  
- **AST Schema**:  
  ```ts
  interface ASTNode {
    id: string;               // deterministic hash of file+span+type+name
    type: string;             // node type
    name?: string;            // identifier if present
    start: { line, column };
    end:   { line, column };
    parentId?: string;
    children: string[];       // child node IDs
  }
  ```
- **Normalization**: strip comments, include only function/class/module definitions plus control-flow nodes.

### 4.3 Annotator (annotate)  

- **Input**: `.astdb/asts/*.json`  
- **Metadata Computation**:  
  - **Signature**: Language-aware extraction for TS/JS/Python (leveraging Tree-sitter heuristics); generic fallback for others.  
  - **Summary**: Template-based generation ("Function X does Y" using name + parameter heuristics).  
  - **Cyclomatic Complexity**: Classical count (1 + decision points): `if`, `for`, `while`, `case`, `catch`, ternary, boolean operators.  
  - **Dependencies**: List of imported symbols referenced in node scope.  
- **Output**: `.astdb/annots/{nodeId}.json`  

  ```ts
  interface Annot {
    nodeId: string;
    file: string;
    signature: string;
    summary: string;
    complexity: number;
    deps: string[];
    sourceSnippet: string;    // up to snippetLines (default 10) with truncation markers
  }
  ```

### 4.4 Embedder (embed)  

- **Model**: `@xenova/transformers` (WASM) as default runtime with CodeBERT-small ONNX (768-dim embeddings).  
- **Model Delivery**: Downloaded from GitHub Releases to `.astdb/models/` on first run with SHA256 checksum verification.  
- **Alternative Runtime**: `--runtime onnx` flag enables `onnxruntime-node` for performance (if available).  
- **Index**: Pure-JS/WASM HNSW implementation by default; optional `hnswlib-node` for performance (via prebuilt binaries).  
- **Metadata**: `index.meta.json` maps nodeId → indexId + vectorHash with versioning for upserts.  
- **Process**:  
  1. Load all new/updated `annots/*.json`.  
  2. For each, concatenate `summary + signature`.  
  3. Compute embedding vector (768 dims default, configurable).  
  4. Upsert via delete+insert using nodeId mapping.  
  5. Serialize index and metadata to disk.

### 4.5 Retriever (query)  

- **CLI**:  

  ```bash
  ast-helper query \
    --intent "refactor payment module logging" \
    --top 5 \
    --format json
  ```

- **Steps**:  
  1. Embed intent text using same model as indexing.  
  2. Load `index.bin` + `index.meta.json`.  
  3. Perform K-NN search, retrieve top-K index IDs.  
  4. Load corresponding `annots/{nodeId}.json`.  
  5. Output array of `{ summary, signature, complexity, deps, sourceSnippet }` in requested format.

### 4.6 Watcher (watch)  

- **Library**: [chokidar](https://github.com/paulmillr/chokidar).  
- **Behavior**: on file add/change/delete under `config.watchGlob`:  
  1. Debounce 200 ms with batching for rapid edit bursts.  
  2. Run `parse --changed`, `annotate --changed`, `embed --changed` sequentially.  
  3. Support `--batch` and `--max-batch-size` options for large repositories.  
- **Use Case**: live prompt enrichment during edit sessions.

### 4.7 VS Code Extension  

- **Language**: TypeScript, VS Code Extension API.  
- **Activation**: Provides both explicit command and optional experimental Copilot interception.  
- **Commands**:  
  - `ast-copilot-helper.enrichAndSend`: Explicit user command (primary, stable).  
  - Optional experimental interception via `enableExperimentalCopilotIntercept` setting.  
- **Logic**:  
  1. Capture user prompt (via command or interception).  
  2. Spawn `ast-helper query --intent "<prompt>" --top 3 --format plain`.  
  3. Prepend returned snippets to prompt.  
  4. Send enriched prompt to Copilot.  
- **Packaging**: Bundled with main package; optional separate VS Code extension registry publish.  
- **Settings**: `topK`, `snippetLines`, enable/disable augmentation, experimental interception opt-in.

---  

## 5. File Structure  

```txt
ast-copilot-helper/
├─ src/
│  ├─ cli/
│  │  └─ index.ts            # commander setup
│  ├─ modules/
│  │  ├─ parser.ts
│  │  ├─ annotator.ts
│  │  ├─ embedder.ts
│  │  ├─ retriever.ts
│  │  ├─ watcher.ts
│  │  └─ downloader.ts       # model & artifact downloader
│  ├─ types.ts               # ASTNode, Annot, config interfaces
│  └─ util/
│     ├─ fs.ts
│     ├─ git.ts
│     └─ crypto.ts           # checksum verification
├─ extension/                # VS Code extension
│  ├─ src/activate.ts
│  └─ package.json
├─ bin/ast-helper.js         # CLI shim
├─ .astdb/                   # created at runtime
│  ├─ asts/                  # raw AST JSON per file
│  ├─ annots/                # annotated metadata JSON per node
│  ├─ grammars/              # cached Tree-sitter grammars
│  ├─ models/                # downloaded embedding models
│  ├─ native/                # optional native binaries
│  ├─ index.bin              # HNSW binary index
│  ├─ index.meta.json        # mapping from index IDs → file + node
│  ├─ config.json            # user overrides (patterns, thresholds)
│  └─ .lock                  # process coordination
├─ tests/
│  ├─ fixtures/              # small sample repos for testing
│  └─ benchmarks/            # 100k LOC performance fixture
├─ LICENSES.md               # model and dependency licenses
├─ NOTICE                    # attribution file
├─ package.json
├─ README.md
└─ tsconfig.json
```

---  

## 6. Configuration  

`.astdb/config.json` (auto-generated on first run, mergeable):  

```json
{
  "parseGlob": ["src/**/*.ts", "src/**/*.js", "src/**/*.py"],
  "watchGlob": ["src/**/*.{ts,js,py}"],
  "reuseIndex": true,
  "embedModelPath": "./models/codebert-small.onnx",
  "modelHost": "https://github.com/EvanDodds/ast-copilot-helper/releases/download/v1.0.0/",
  "useNativeRuntime": false,
  "topK": 5,
  "snippetLines": 10,
  "enableTelemetry": false,
  "telemetryEndpoint": "",
  "indexParams": {
    "efConstruction": 200,
    "M": 16
  }
}
```

---  

## 7. Implementation Roadmap  

1. **Project Scaffold & Core Parse** (~Week 1-2)
   - Set up TypeScript project structure with commander.js CLI
   - Implement `parse` with Tree-sitter integration (TS/JS/Python grammars)
   - Add deterministic node ID generation and git integration
   - Create basic test fixtures and unit tests

2. **Annotation & Template Summaries** (~Week 2-3)  
   - Build `annotate` with language-aware signature extraction
   - Implement template-based summary generation
   - Add cyclomatic complexity calculation and dependency analysis
   - Create comprehensive annotation test suite

3. **Embedding & Vector Index** (~Week 3-4)
   - Integrate `@xenova/transformers` with model downloader and verification
   - Implement pure-JS/WASM HNSW index with upsert support
   - Add model caching, checksum verification, and optional signature checking
   - Build performance tests for embedding and indexing

4. **Query & Retrieval** (~Week 4-5)
   - Complete `query` implementation with JSON/plain output formats
   - Add comprehensive CLI argument parsing and configuration merging
   - Implement file locking and process coordination
   - Add end-to-end integration tests

5. **Watch Mode & Performance** (~Week 5-6)
   - Implement `watch` with debouncing and batching for large repos
   - Add 100k LOC performance fixture and benchmarking
   - Optimize for repository scale targets and query latency
   - Add optional native runtime support (hnswlib-node, onnxruntime-node)

6. **VS Code Extension** (~Week 6-7)
   - Develop extension with explicit command and optional experimental interception
   - Add user settings for topK, snippet length, and augmentation controls
   - Implement telemetry opt-in framework (disabled by default)
   - Test Copilot integration end-to-end

7. **Release & Distribution** (~Week 7-8)
   - Set up CI for prebuilt native binaries (Windows x64, macOS arm64/x64, Linux x64)
   - Add artifact signing with Sigstore/GPG and checksum publishing
   - Complete LICENSES.md, NOTICE, and privacy documentation
   - Publish to NPM with optional VS Code extension registry  

---  

## 8. Testing & Validation  

- **Unit tests** for each module using Jest with comprehensive coverage targets.
- **Integration tests** against sample repo fixtures: verify AST JSON schema, annotation completeness, index build/query accuracy.  
- **Performance benchmarks**: 
  - Target: Index 100k nodes in <10 minutes on 2-CPU 8GB CI runner
  - Target: Top-5 query latency <200ms average
  - Memory usage profiling for large repositories
- **End-to-end workflow validation**: 
  - Git hooks: commit → parse/annotate → pre-push embed → index updates
  - VS Code extension: prompt enrichment → query execution → Copilot integration
  - Scale testing: synthetic 100k LOC fixture with representative language distribution
- **Security testing**: Model download verification, checksum validation, signature checking  

---  

## 9. Example Usage  

```bash
# Installation
npm install -D ast-copilot-helper husky

# Setup git hooks (recommended)
npx husky install
npx husky add .husky/pre-commit "ast-helper parse --changed && ast-helper annotate --changed"
npx husky add .husky/pre-push   "ast-helper embed --changed"

# Manual operations
ast-helper parse --glob "src/**/*.{ts,js,py}"    # Parse specific files
ast-helper annotate --changed                    # Annotate changed files
ast-helper embed --changed                       # Update embeddings
ast-helper query --intent "error handling" --top 5  # Search for relevant code

# Development workflow
ast-helper watch                  # Live updates during development
# In VS Code: use Copilot Chat - prompts are auto-enriched with relevant AST context

# CI/CD workflow
ast-helper parse --changed        # Parse changed files
ast-helper annotate --changed     # Generate annotations  
ast-helper embed --changed        # Update vector index
ast-helper query --intent "test coverage" --format json > context.json  # Export for other tools
```

---

## 10. Error Handling & Recovery

### 10.1 Corruption Detection & Recovery

**Index Corruption**
- **Detection**: Checksum validation on index load, schema version checks
- **Recovery**: Automatic rebuild from annotations with user confirmation
- **Prevention**: Atomic writes, backup index during updates

**Model Download Failures**
- **Retry Logic**: Exponential backoff (3 attempts max)
- **Fallback**: Graceful degradation with warning messages
- **Offline Mode**: Use cached models when available

**Parse Failures**
- **Individual Files**: Log error, continue with other files
- **Grammar Issues**: Download latest grammar, retry once
- **Syntax Errors**: Skip malformed files with detailed logging

### 10.2 Concurrent Access Management

**File Locking Strategy**
```typescript
interface LockManager {
  acquireExclusiveLock(operation: 'parse' | 'embed' | 'query'): Promise<Lock>;
  acquireSharedLock(operation: 'query'): Promise<Lock>;
  releaseLock(lock: Lock): void;
}
```

**Multi-Process Coordination**
- Exclusive locks for write operations (parse, annotate, embed)
- Shared locks for read operations (query)
- Timeout handling (30s default, configurable)
- Deadlock detection and recovery

### 10.3 Memory Management

**Large Repository Handling**
- Streaming processing for files >10MB
- Batch processing: max 100 files per batch
- Memory pressure detection and graceful degradation
- Configurable memory limits per operation

---

## 11. Deployment & Operations

### 11.1 CI/CD Pipeline Specification

**GitHub Actions Workflow** (`.github/workflows/release.yml`)
```yaml
name: Build and Release
on:
  push:
    tags: ['v*']
    
jobs:
  build-prebuilts:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        arch: [x64, arm64]  # arm64 only for macOS
    steps:
      - name: Build native binaries
        run: npm run build:native
      - name: Sign artifacts
        run: npm run sign:artifacts
      - name: Upload to release
        uses: actions/upload-release-asset@v1
```

**Artifact Naming Convention**
- `ast-copilot-helper-{version}-{platform}-{arch}.tar.gz`
- `ast-copilot-helper-models-{version}.tar.gz` (CodeBERT model)
- `checksums.txt` with SHA256 hashes
- `signatures.txt` with Sigstore signatures

### 11.2 Monitoring & Observability

**Performance Metrics Collection**
```typescript
interface Metrics {
  parseTime: number;           // ms per file
  annotateTime: number;        // ms per node  
  embedTime: number;          // ms per embedding
  queryLatency: number;       // ms per query
  indexSize: number;          // bytes
  memoryUsage: number;        // peak MB
}
```

**Health Checks**
- Index integrity validation
- Model availability check  
- Git integration status
- VS Code extension connectivity

**Logging Framework**
```typescript
interface Logger {
  error(message: string, context?: object): void;
  warn(message: string, context?: object): void;  
  info(message: string, context?: object): void;
  debug(message: string, context?: object): void;
}
```

### 11.3 Migration & Upgrade Strategies

**Schema Versioning**
```typescript
interface ASTDBVersion {
  schemaVersion: string;        // "1.0.0"
  modelVersion: string;         // "codebert-small-v1"  
  indexVersion: string;         // "hnsw-v2"
  migrationPath?: string;       // upgrade script
}
```

**Migration Procedures**
1. **Backup existing .astdb directory**
2. **Run migration script if available**  
3. **Rebuild index if schema incompatible**
4. **Validate migrated data**
5. **Rollback on failure**

---

## 12. Advanced Configuration & Tuning

### 12.1 Extended Configuration Schema

```json
{
  // Core settings (from previous spec)
  "parseGlob": ["src/**/*.{ts,js,py}"],
  "watchGlob": ["src/**/*.{ts,js,py}"],
  
  // Performance tuning
  "performance": {
    "maxMemoryMB": 2048,
    "batchSize": 100,
    "maxFileSize": "10MB",
    "timeoutMs": 30000,
    "concurrentParsers": 4
  },
  
  // Error handling  
  "errorHandling": {
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "continueOnParseError": true,
    "autoRebuildCorrupted": false,
    "logLevel": "info"
  },
  
  // Advanced features
  "advanced": {
    "enableIncrementalParsing": true,
    "enableSemanticCaching": true,  
    "pruneStaleEntries": true,
    "compressionLevel": 6,
    "enableProfiler": false
  },
  
  // Platform-specific
  "platform": {
    "preferNativeBinaries": true,
    "fallbackToWasm": true,
    "enableGpuAcceleration": false,
    "customBinaryPath": null
  }
}
```

### 12.2 Performance Optimization Guidelines  

**Large Repository Optimization**
- Use `--changed` flag to limit scope
- Enable incremental parsing for faster updates
- Consider splitting very large repositories  
- Monitor memory usage and adjust batch sizes

**Query Performance Tuning**
- Adjust HNSW parameters (M, efConstruction) based on index size
- Use query caching for repeated searches
- Consider model quantization for faster inference

**VS Code Extension Performance**
- Set reasonable query timeouts (5-10s)
- Implement query debouncing (500ms)
- Cache recent query results
- Provide loading indicators for long operations

---

## 13. Testing & Quality Assurance

### 13.1 Comprehensive Testing Strategy

**Unit Testing (Jest + TypeScript)**
- **Target Coverage**: 90%+ for core modules
- **Test Categories**: 
  - Parser functionality with malformed ASTs
  - Annotation generation with edge cases
  - Embedding model integration and caching
  - Query performance and accuracy
  - Configuration validation and merging

**Integration Testing**
- **Multi-language Repository**: Test with TypeScript + Python + JavaScript
- **Large Scale Testing**: 100k LOC synthetic repository  
- **Git Workflow Testing**: Various git states (clean, dirty, staged, conflicts)
- **Cross-platform Testing**: Windows, macOS, Linux environments

**End-to-End Testing**
- **Complete Workflow**: Parse → Annotate → Embed → Query → VS Code integration
- **Performance Benchmarks**: Automated performance regression testing
- **VS Code Extension Testing**: Mock Copilot interactions, user scenarios

**Edge Case Testing Matrix**
```typescript
interface EdgeCaseTest {
  scenario: string;
  expectedBehavior: string;
  testMethod: string;
}

const edgeCases: EdgeCaseTest[] = [
  {
    scenario: "Empty repository",
    expectedBehavior: "Graceful handling with informative message",
    testMethod: "Full workflow on empty git repo"
  },
  {
    scenario: "Very large single file (>50MB)",
    expectedBehavior: "Memory-bounded processing with streaming",  
    testMethod: "Generate large synthetic file and test parsing"
  },
  {
    scenario: "Corrupted .astdb directory",
    expectedBehavior: "Detection and recovery with user confirmation",
    testMethod: "Deliberately corrupt index and test recovery"
  },
  // ... additional edge cases
];
```

### 13.2 Performance Benchmarking Framework

**Benchmark Scenarios**
- Repository sizes: 1k, 10k, 100k, 500k LOC
- Language distributions: TS-only, multi-language, Python-heavy
- Query types: Simple keywords, complex semantic queries, frequent vs. rare terms

**Metrics Collection**
```typescript
interface BenchmarkResult {
  timestamp: Date;
  repoSize: number;           // Lines of code
  parseTimeMs: number;        // Full parse duration
  annotateTimeMs: number;     // Full annotation duration  
  embedTimeMs: number;        // Full embedding duration
  queryLatencyP95: number;    // 95th percentile query time
  memoryPeakMB: number;       // Peak memory usage
  indexSizeMB: number;        // Disk usage
  gitCommitHash: string;      // Version under test
}
```

**Automated Performance Gates**
- Parse: <5 minutes per 100k LOC
- Query: <500ms P95 latency
- Memory: <4GB peak for 100k LOC
- Index size: <200MB for 100k LOC

---

## 14. Security & Privacy

### 14.1 Security Hardening

**Input Validation**
- File path sanitization (prevent directory traversal)
- Git command injection prevention  
- Model file integrity verification (checksums + signatures)
- Configuration file schema validation

**Privilege Management**
- Minimal file system permissions required
- No network access except for model downloads
- Sandboxed model execution where possible
- User consent for all network operations

**Supply Chain Security**
```typescript
interface SecurityCheck {
  artifact: string;
  checksum: string;
  signature?: string;
  downloadUrl: string;
  verificationKey: string;
}

const securityChecks: SecurityCheck[] = [
  {
    artifact: "codebert-small.onnx",
    checksum: "sha256:a1b2c3d4e5f6...",
    signature: "cosign signature blob",
    downloadUrl: "https://github.com/EvanDodds/ast-copilot-helper/releases/...",
    verificationKey: "cosign-public.pem"
  }
];
```

### 14.2 Privacy Protection

**Data Locality Guarantees**
- All code processing remains local (no cloud transmission)
- Embeddings computed and stored locally
- Query results never leave the machine
- Optional telemetry is anonymized and aggregated only

**Sensitive Data Handling**
- Skip files matching `.gitignore` patterns
- Configurable exclusion patterns for sensitive files
- Automatic detection of potential secrets in ASTs
- Option to exclude certain node types (e.g., string literals)

---

## 15. User Documentation & Support

### 15.1 Installation & Setup Guide

**Prerequisites Check**
```bash
# System requirements validation
ast-helper doctor                 # Check system compatibility
ast-helper doctor --fix          # Attempt to resolve common issues
```

**Step-by-Step Setup**
1. **Install**: `npm install -D ast-copilot-helper`
2. **Initialize**: `ast-helper init` (creates `.astdb/` and default config)
3. **First Parse**: `ast-helper parse` (processes entire repository)
4. **Setup Git Hooks**: `ast-helper setup-hooks` (automated husky integration)
5. **Install VS Code Extension**: Via marketplace or `ast-helper install-extension`

### 15.2 Troubleshooting Guide

**Common Issues & Solutions**
| Issue | Symptoms | Solution |
|-------|----------|----------|
| Parse failures | "Unknown language" errors | Run `ast-helper grammar install <language>` |
| Slow performance | High CPU/memory usage | Adjust batch size in config, use `--changed` flag |
| VS Code integration broken | No prompt enrichment | Check extension logs, verify CLI in PATH |
| Index corruption | Query errors | Run `ast-helper rebuild` to reconstruct index |
| Model download fails | Network/checksum errors | Check internet connection, verify firewall settings |

**Diagnostic Commands**
```bash
ast-helper status               # System status and configuration
ast-helper validate             # Check .astdb integrity  
ast-helper debug --query "test" # Verbose query execution
ast-helper logs --tail 50       # View recent operation logs
```

### 15.3 Configuration Examples

**TypeScript Monorepo**
```json
{
  "parseGlob": ["packages/*/src/**/*.{ts,tsx}"],
  "watchGlob": ["packages/*/src/**/*.{ts,tsx}"], 
  "performance": {
    "batchSize": 50,
    "maxMemoryMB": 4096
  }
}
```

**Python Data Science Project**
```json  
{
  "parseGlob": ["src/**/*.py", "notebooks/**/*.py"],
  "excludePatterns": ["**/test_*.py", "**/__pycache__/**"],
  "topK": 8,
  "snippetLines": 15
}
```

---

## 16. Architecture Decisions & Implementation Plan

This section consolidates all architectural decisions, trade-offs, and implementation approaches into a unified plan.

### 16.1 Language & Parser Stack

**Decision**: Multi-language support with TS/JS/Python in initial release
- **Parser**: Tree-sitter with native `node-tree-sitter` + WASM fallback via `tree-sitter-wasm`  
- **Grammars**: Downloaded on-demand to `.astdb/grammars/` with version pins
- **Node Identity**: Deterministic hash of (file path + span + type + name) for stable upserts
- **Normalization**: Include function/class/module definitions + control-flow; strip comments

### 16.2 Annotation & Analysis

**Decision**: Template-based approach with language-aware extraction
- **Signatures**: Language-specific extraction for TS/JS/Python; generic fallback for others
- **Summaries**: Template generation ("Function X does Y" using heuristics)
- **Complexity**: Classical cyclomatic (1 + decision points: if/for/while/case/catch/ternary/boolean-ops)
- **Dependencies**: Import symbol analysis within node scope
- **Snippets**: Configurable lines (default 10) with truncation markers

### 16.3 Embedding & Indexing

**Decision**: Hybrid runtime approach with pure-JS default
- **Model**: CodeBERT-small ONNX (768-dim) via `@xenova/transformers` WASM runtime
- **Delivery**: Download from GitHub Releases with SHA256 verification + optional signing
- **Alternative**: `--runtime onnx` flag for `onnxruntime-node` (if available)
- **Index**: Pure-JS/WASM HNSW by default; optional `hnswlib-node` via prebuilt binaries
- **Upserts**: Delete+insert via `index.meta.json` mapping; tombstone cleanup for non-deletable backends

### 16.4 Git Integration & File Handling

**Decision**: Flexible git workflow integration
- **Default**: `git diff --name-only --diff-filter=ACMRT HEAD`
- **Overrides**: `--staged` and `--base <ref>` flags for different workflows
- **Watch**: Debounced (200ms) with batching for rapid edits; `--batch` and `--max-batch-size` options
- **Concurrency**: File lock at `.astdb/.lock`; auto-rebuild on corruption (opt-in)

### 16.5 VS Code Extension Strategy

**Decision**: Dual approach for reliability and UX
- **Primary**: Explicit `ast-copilot-helper.enrichAndSend` command (stable)
- **Experimental**: Optional Copilot interception via `enableExperimentalCopilotIntercept` setting
- **Settings**: Configurable `topK`, `snippetLines`, augmentation enable/disable
- **Output**: `--format plain` for extension consumption

### 16.6 Distribution & Native Performance

**Decision**: Zero-dependency default with optional native optimization
- **Core Package**: Pure-JS/WASM, works everywhere, reasonable performance
- **Prebuilt Binaries**: CI-produced artifacts for Windows x64, macOS (arm64/x64), Linux x64
- **Delivery**: GitHub Releases with SHA256 checksums + Sigstore/GPG signing
- **Opt-in**: `--use-native` flag or postinstall configuration for performance users

### 16.7 Privacy & Telemetry

**Decision**: Privacy-first with opt-in analytics
- **Default**: No telemetry, explicit privacy guarantee (no code/embeddings leave machine)
- **Opt-in**: Anonymous error counts, environment metadata, performance metrics
- **Retention**: 90-day limit with documented opt-out/deletion process
- **Endpoint**: Configurable URL (disabled until endpoint decided)

---

## 17. Implementation Checklist

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Project scaffold with TypeScript + commander.js
- [ ] Tree-sitter integration (TS/JS/Python) with grammar downloader
- [ ] Deterministic node ID generation and AST normalization
- [ ] Git integration (`--changed`, `--staged`, `--base` options)
- [ ] Basic test suite with small fixtures
- [ ] Error handling framework and logging system

### Phase 2: Annotation Pipeline (Week 2-3)
- [ ] Language-aware signature extraction (TS/JS/Python + generic fallback)
- [ ] Template-based summary generation with heuristics
- [ ] Cyclomatic complexity calculator 
- [ ] Dependency analysis (import symbol tracking)
- [ ] Snippet extraction with truncation handling
- [ ] Comprehensive edge case testing

### Phase 3: Embedding & Indexing (Week 3-4)
- [ ] Model downloader with SHA256 verification and retry logic
- [ ] `@xenova/transformers` integration with CodeBERT-small
- [ ] Pure-JS/WASM HNSW index implementation
- [ ] Upsert logic via `index.meta.json` mapping
- [ ] Optional `onnxruntime-node` + `hnswlib-node` support
- [ ] Index corruption detection and recovery

### Phase 4: Query & CLI (Week 4-5)
- [ ] Query implementation with embedding + K-NN search
- [ ] CLI argument parsing and configuration merging
- [ ] JSON/plain output formatting with proper error codes
- [ ] File locking and process coordination
- [ ] Comprehensive error handling and user-friendly messages
- [ ] Performance benchmarking framework

### Phase 5: Watch & Performance (Week 5-6)
- [ ] Watch mode with debouncing and batching
- [ ] 100k LOC synthetic performance fixture
- [ ] Benchmarking suite with latency/memory profiling
- [ ] Performance optimization for large repositories
- [ ] Native runtime opt-in workflow
- [ ] Memory management and resource cleanup

### Phase 6: VS Code Extension (Week 6-7)
- [ ] Extension with explicit command + experimental interception
- [ ] Settings UI for topK, snippets, augmentation controls
- [ ] Telemetry opt-in framework (disabled by default)
- [ ] End-to-end Copilot integration testing
- [ ] Error handling and timeout management
- [ ] Extension marketplace preparation

### Phase 7: Release & Operations (Week 7-8)
- [ ] CI jobs for prebuilt native binaries (multi-platform)
- [ ] Artifact signing with Sigstore/cosign
- [ ] Release automation with checksum publishing
- [ ] `LICENSES.md`, `NOTICE`, and privacy documentation
- [ ] NPM publishing + optional VS Code extension registry
- [ ] User documentation and troubleshooting guides
- [ ] Monitoring and health check systems

---

## 18. Open Questions & Next Actions

### 18.1 Resolved Questions
✅ **Model Licensing**: Download-only approach with GitHub Releases hosting  
✅ **Distribution Strategy**: Pure-JS default + optional prebuilt binaries  
✅ **Telemetry**: Privacy-first with opt-in anonymous metrics  
✅ **Scale Target**: 100k LOC repositories with specific performance benchmarks  
✅ **Language Support**: TS/JS/Python in initial release  
✅ **Security**: Comprehensive signing and verification pipeline  

### 18.2 Implementation Dependencies

**Legal & Compliance**
- [ ] **Model License Verification**: Confirm CodeBERT-small redistribution rights and attribution requirements
- [ ] **Privacy Policy**: Draft privacy policy for optional telemetry collection
- [ ] **Open Source License**: Finalize project license (MIT recommended)

**Infrastructure Setup**  
- [ ] **CI/CD Pipeline**: Configure GitHub Actions for multi-platform builds
- [ ] **Artifact Signing**: Set up Sigstore/cosign signing infrastructure
- [ ] **Model Hosting**: Prepare GitHub Releases for model artifact distribution
- [ ] **VS Code Extension**: Register VS Code marketplace publisher account

**Technical Validation**
- [ ] **Performance Baselines**: Establish 100k LOC test repository and baseline metrics
- [ ] **Platform Testing**: Validate functionality across Windows/macOS/Linux environments  
- [ ] **Integration Testing**: End-to-end VS Code + Copilot integration validation
- [ ] **Security Audit**: Third-party security review of download and verification systems

### 18.3 Success Criteria

**Technical Milestones**
- [ ] Parse 100k LOC repository in <10 minutes on CI runner
- [ ] Query latency <200ms P95 for top-5 results
- [ ] Zero-dependency install success rate >95% across platforms
- [ ] VS Code extension functional with all major Copilot scenarios

**User Experience Goals**
- [ ] Single-command installation and setup
- [ ] Measureable improvement in Copilot suggestion relevance  
- [ ] <5% performance overhead during active development
- [ ] Comprehensive troubleshooting documentation

**Operational Readiness**
- [ ] Automated CI/CD pipeline with security scanning
- [ ] Comprehensive monitoring and health checks
- [ ] User documentation and community support channels
- [ ] Maintenance and update procedures documented

---

## Summary

This specification now provides a comprehensive, implementation-ready blueprint for the ast-copilot-helper system. Key enhancements include:

- **Complete Error Handling**: Corruption detection, recovery procedures, edge case management
- **Operational Excellence**: CI/CD pipeline, monitoring, deployment automation  
- **Security Hardening**: Input validation, privilege management, supply chain security
- **Comprehensive Testing**: Unit, integration, performance, and edge case testing strategies
- **User Experience**: Installation guides, troubleshooting, configuration examples
- **Implementation Roadmap**: 8-week development plan with specific deliverables and success metrics

The document addresses all major implementation concerns and provides the technical depth needed for a development team to build a production-ready system. All architectural decisions have been integrated, remaining open questions have been identified with clear next actions, and the specification balances technical rigor with practical implementability.
