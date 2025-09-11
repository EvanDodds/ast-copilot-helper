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

This section consolidates all architectural decisions, trade-offs, and implementation approaches into a unified plan. All previously open questions have been resolved and integrated below.

### 16.1 Language & Parser Stack

**Decision**: Multi-language support with TS/JS/Python in initial release
- **Parser**: Tree-sitter with native `node-tree-sitter` + WASM fallback via `tree-sitter-wasm`  
- **Grammars**: Downloaded on-demand to `.astdb/grammars/` with version pins
- **Node Identity**: Deterministic hash of (file path + span + type + name) for stable upserts
- **Normalization**: Include function/class/module definitions + control-flow; strip comments
- **Rationale**: Balanced approach supporting major languages while maintaining package size and reliability

### 16.2 Annotation & Analysis

**Decision**: Template-based approach with language-aware extraction
- **Signatures**: Language-specific extraction for TS/JS/Python; generic fallback for others
- **Summaries**: Template generation ("Function X does Y" using heuristics)
- **Complexity**: Classical cyclomatic (1 + decision points: if/for/while/case/catch/ternary/boolean-ops)
- **Dependencies**: Import symbol analysis within node scope
- **Snippets**: Configurable lines (default 10) with truncation markers
- **Rationale**: Provides deterministic, reproducible results without external dependencies

### 16.3 Embedding & Indexing

**Decision**: Hybrid runtime approach with pure-JS default
- **Model**: CodeBERT-small ONNX (768-dim) via `@xenova/transformers` WASM runtime
- **Delivery**: Download from GitHub Releases with SHA256 verification + optional signing
- **Alternative**: `--runtime onnx` flag for `onnxruntime-node` (if available)
- **Index**: Pure-JS/WASM HNSW by default; optional `hnswlib-node` via prebuilt binaries
- **Upserts**: Delete+insert via `index.meta.json` mapping; tombstone cleanup for non-deletable backends
- **Rationale**: Zero-dependency baseline with performance upgrade path for power users

### 16.4 Git Integration & File Handling

**Decision**: Flexible git workflow integration
- **Default**: `git diff --name-only --diff-filter=ACMRT HEAD`
- **Overrides**: `--staged` and `--base <ref>` flags for different workflows
- **Watch**: Debounced (200ms) with batching for rapid edits; `--batch` and `--max-batch-size` options
- **Concurrency**: File lock at `.astdb/.lock`; auto-rebuild on corruption (opt-in)
- **Rationale**: Supports common git workflows while providing flexibility for different CI/development patterns

### 16.5 VS Code Extension Strategy

**Decision**: Dual approach for reliability and UX
- **Primary**: Explicit `ast-copilot-helper.enrichAndSend` command (stable)
- **Experimental**: Optional Copilot interception via `enableExperimentalCopilotIntercept` setting
- **Settings**: Configurable `topK`, `snippetLines`, augmentation enable/disable
- **Output**: `--format plain` for extension consumption
- **Rationale**: Provides stable integration with experimental convenience feature for power users

### 16.6 Distribution & Native Performance

**Decision**: Zero-dependency default with optional native optimization
- **Core Package**: Pure-JS/WASM, works everywhere, reasonable performance
- **Prebuilt Binaries**: CI-produced artifacts for Windows x64, macOS (arm64/x64), Linux x64
- **Delivery**: GitHub Releases with SHA256 checksums + Sigstore/GPG signing
- **Opt-in**: `--use-native` flag or postinstall configuration for performance users
- **Rationale**: Maximizes compatibility while providing performance upgrade path

### 16.7 Privacy & Telemetry

**Decision**: Privacy-first with opt-in analytics
- **Default**: No telemetry, explicit privacy guarantee (no code/embeddings leave machine)
- **Opt-in**: Anonymous error counts, environment metadata, performance metrics
- **Retention**: 90-day limit with documented opt-out/deletion process
- **Endpoint**: Configurable URL (disabled until endpoint decided)
- **Rationale**: Respects user privacy while enabling optional product improvement data

### 16.8 Security & Supply Chain

**Decision**: Comprehensive verification pipeline
- **Downloads**: HTTPS + SHA256 checksums for all artifacts (models, prebuilds)
- **Signing**: Sigstore/cosign for artifact authenticity
- **Verification**: Public keys stored in repo with documented validation steps
- **Licenses**: `LICENSES.md` and `NOTICE` files with model attribution
- **Rationale**: Enterprise-grade security practices for supply chain integrity

### 16.9 Scale & Performance Targets

**Decision**: Enterprise-grade scale planning
- **Target**: 100k LOC repositories (validated requirement from stakeholders)
- **Benchmarks**: 
  - Full index build: <10 minutes (2-CPU 8GB CI runner)
  - Query latency: <200ms average for top-5 results
  - Memory: Efficient for large codebases with batching
- **Testing**: Synthetic fixture combining real projects + generated code
- **Rationale**: Targets real-world enterprise development environments

---

## 18. Outstanding Implementation Dependencies

### 18.1 Legal & Compliance Requirements

**Model License Verification** (Legal Team)
- [ ] Confirm CodeBERT-small redistribution rights and attribution requirements
- [ ] Obtain exact license text and attribution format
- [ ] Verify download-only distribution approach compliance

**Privacy & Legal Documentation** (Legal/Product)
- [ ] Draft privacy policy for optional telemetry collection
- [ ] Finalize project open source license (MIT recommended)
- [ ] Review GDPR/privacy compliance for telemetry features

### 18.2 Infrastructure Setup

**CI/CD Pipeline Configuration** (DevOps)
- [ ] Configure GitHub Actions for multi-platform native binary builds
- [ ] Set up automated testing across Windows/macOS/Linux environments
- [ ] Implement release automation with version tagging

**Artifact Security & Distribution** (DevOps/Security)
- [ ] Set up Sigstore/cosign signing infrastructure with key management
- [ ] Configure GitHub Releases for secure model and binary distribution
- [ ] Establish artifact verification procedures and documentation

**Extension Publishing** (Product/Engineering)
- [ ] Register VS Code marketplace publisher account
- [ ] Prepare extension packaging and submission process
- [ ] Set up extension update and distribution pipeline

### 18.3 Technical Validation

**Performance Baseline Establishment** (QA/Engineering)
- [ ] Create 100k LOC synthetic test repository with representative code
- [ ] Establish baseline performance metrics on standard CI hardware
- [ ] Define automated performance regression testing procedures

**Cross-Platform Validation** (QA)
- [ ] Validate functionality across Windows 10/11, macOS 12+, Ubuntu 20.04+
- [ ] Test installation and operation on common development environments
- [ ] Verify graceful degradation when native dependencies unavailable

**Security & Integration Testing** (Security/QA)
- [ ] Conduct third-party security review of download and verification systems
- [ ] Validate end-to-end VS Code + Copilot integration across scenarios
- [ ] Test security hardening measures and input validation

---

## 19. Success Criteria & Delivery Readiness

### 19.1 Technical Milestones

**Core Functionality**
- [ ] Parse 100k LOC repository in <10 minutes on 2-CPU 8GB CI runner
- [ ] Query latency <200ms P95 for top-5 results with warm index
- [ ] Zero-dependency install success rate >95% across supported platforms
- [ ] Memory usage scales linearly with repository size (efficient batching)

**Integration & User Experience**
- [ ] VS Code extension functional with all major Copilot scenarios
- [ ] Single-command installation and setup (npm install + init)
- [ ] Comprehensive error messages and recovery procedures
- [ ] <5% performance overhead during active development in VS Code

### 19.2 Operational Readiness

**Production Systems**
- [ ] Automated CI/CD pipeline with security scanning and artifact signing
- [ ] Comprehensive monitoring and health check systems operational
- [ ] User documentation, troubleshooting guides, and support channels ready
- [ ] Maintenance procedures and update mechanisms documented and tested

**Quality Assurance**
- [ ] 90%+ test coverage across unit, integration, and end-to-end scenarios
- [ ] Performance benchmarking suite with automated regression detection
- [ ] Security audit completed with all findings addressed
- [ ] Beta testing program with representative user feedback incorporated

### 19.3 Launch Prerequisites

**Documentation & Support**
- [ ] Installation guide with platform-specific instructions
- [ ] Configuration examples for common project types
- [ ] Troubleshooting guide covering common issues and solutions
- [ ] API documentation for advanced configuration and integration

**Legal & Compliance**
- [ ] All licenses, attributions, and legal requirements satisfied
- [ ] Privacy policy published and telemetry consent mechanisms implemented
- [ ] Open source license applied and contributor guidelines established

**Community & Ecosystem**
- [ ] GitHub repository with comprehensive README and contribution guidelines
- [ ] Issue tracking and support processes established
- [ ] VS Code marketplace listing with screenshots and feature descriptions
- [ ] NPM package published with proper metadata and keywords

---

This consolidated organization eliminates redundancy while maintaining all critical implementation guidance and outstanding requirements. The document now flows logically from architecture decisions through implementation details to delivery readiness criteria.

## Summary

This specification now provides a comprehensive, implementation-ready blueprint for the ast-copilot-helper system. Key enhancements include:

- **Complete Error Handling**: Corruption detection, recovery procedures, edge case management
- **Operational Excellence**: CI/CD pipeline, monitoring, deployment automation  
- **Security Hardening**: Input validation, privilege management, supply chain security
- **Comprehensive Testing**: Unit, integration, performance, and edge case testing strategies
- **User Experience**: Installation guides, troubleshooting, configuration examples
- **Implementation Roadmap**: 8-week development plan with specific deliverables and success metrics

The document addresses all major implementation concerns and provides the technical depth needed for a development team to build a production-ready system. All architectural decisions have been integrated, remaining open questions have been identified with clear next actions, and the specification balances technical rigor with practical implementability.
