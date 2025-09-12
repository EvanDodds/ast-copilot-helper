# AST Copilot Helper - Implementation Specification

## Overview

This document provides a concrete, step-by-step implementation roadmap for the ast-copilot-helper project. It transforms the architectural specification into an actionable development plan with specific tasks, timelines, and deliverables.

## Implementation Timeline: 10-Week Development Plan

### Week 1: Foundation & Project Setup

#### Day 1-2: Project Initialization
**Deliverables:**
- [ ] Initialize npm project with TypeScript configuration
- [ ] Set up directory structure matching specification
- [ ] Configure build pipeline and development tooling

**Tasks:**
```bash
# Initialize project
npm init -y
npm install -D typescript @types/node ts-node nodemon jest @types/jest ts-jest

# Set up TypeScript configuration
```

**File Structure to Create:**
```
ast-copilot-helper/
├─ src/
│  ├─ cli/
│  │  └─ index.ts                # CLI entry point
│  ├─ modules/
│  │  ├─ parser.ts               # AST parsing
│  │  ├─ annotator.ts            # Metadata generation
│  │  ├─ embedder.ts             # Vector embeddings
│  │  ├─ retriever.ts            # Query processing
│  │  ├─ watcher.ts              # File watching
│  │  └─ downloader.ts           # Model downloads
│  ├─ types.ts                   # TypeScript interfaces
│  └─ util/
│     ├─ fs.ts                   # File system utilities
│     ├─ git.ts                  # Git integration
│     └─ crypto.ts               # Checksum verification
├─ bin/
│  └─ ast-helper.js              # CLI executable
├─ tests/
│  └─ fixtures/                  # Test data
└─ extension/                    # VS Code extension
   └─ src/
      └─ activate.ts
```

**Configuration Files:**
- `tsconfig.json`: TypeScript compilation settings
- `jest.config.js`: Testing configuration
- `package.json`: Dependencies and scripts

#### Day 3: Configuration System Implementation
**Deliverables:**
- [ ] Configuration schema and validation
- [ ] Multi-source configuration loading (CLI > env > project > user > defaults)
- [ ] `.astdb/config.json` structure

**Implementation:**
```typescript
// src/types.ts
interface Config {
  parseGlob: string[];
  watchGlob: string[];
  reuseIndex: boolean;
  embedModelPath: string;
  modelHost: string;
  useNativeRuntime: boolean;
  topK: number;
  snippetLines: number;
  enableTelemetry: boolean;
  telemetryEndpoint: string;
  indexParams: {
    efConstruction: number;
    M: number;
  };
}

// Configuration loading logic with precedence
class ConfigManager {
  loadConfig(cliArgs: any): Config;
  validateConfig(config: Partial<Config>): Config;
  saveConfig(config: Config): void;
}
```

#### Day 4-5: CLI Framework Setup
**Deliverables:**
- [ ] Commander.js integration with all subcommands
- [ ] Global options handling (--verbose, --config, --help)
- [ ] Stub implementations for all commands

**Implementation:**
```typescript
// src/cli/index.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('ast-helper')
  .description('AST-based context enhancement for GitHub Copilot')
  .version('1.0.0');

program
  .command('parse')
  .description('Extract AST from source files')
  .option('-c, --changed', 'Process only changed files')
  .option('--glob <pattern>', 'File pattern to parse')
  .option('--base <ref>', 'Git reference for change detection')
  .option('--staged', 'Include only staged files')
  .option('-f, --force', 'Force reparse even if unchanged')
  .action(parseCommand);

// Additional commands: annotate, embed, query, watch
```

### Week 2: Core Parsing & AST System

#### Day 1-2: File System & Git Integration
**Deliverables:**
- [ ] Git utilities for changed file detection
- [ ] Cross-platform file system operations
- [ ] File locking mechanism (.astdb/.lock)

**Implementation Focus:**
```typescript
// src/util/git.ts
class GitUtils {
  async getChangedFiles(base?: string, staged?: boolean): Promise<string[]>;
  async isGitRepository(): Promise<boolean>;
  async getCurrentBranch(): Promise<string>;
}

// src/util/fs.ts
class FileSystemUtils {
  async acquireLock(lockFile: string, timeout: number): Promise<Lock>;
  async releaseLock(lock: Lock): void;
  async ensureDirectory(path: string): void;
  async safeWrite(file: string, content: string): void;
}
```

**Critical Decisions:**
- File locking strategy across platforms (lockfile vs flock)
- Git integration robustness (handling various git states)
- Path normalization for cross-platform compatibility

#### Day 3-4: Tree-sitter Integration
**Deliverables:**
- [ ] Tree-sitter parser setup with WASM fallback
- [ ] Grammar download and caching system
- [ ] Language detection from file extensions

**Implementation:**
```typescript
// src/modules/parser.ts
class ASTParser {
  private parsers: Map<string, any> = new Map();
  
  async getParser(language: string): Promise<any>;
  async downloadGrammar(language: string): Promise<void>;
  async parseFile(filePath: string, content: string): Promise<ASTNode>;
  normalizeAST(rawAST: any): ASTNode;
}
```

**Critical Implementation Details:**
- Grammar versioning and update strategy
- Error handling for unsupported languages
- Performance optimization for large files

#### Day 5: Parse Command Implementation
**Deliverables:**
- [ ] Full parse command functionality
- [ ] Batch processing with progress reporting
- [ ] AST storage in `.astdb/asts/`

**Features:**
- Parallel processing of multiple files
- Incremental parsing (--changed flag)
- Progress reporting for large repositories
- Error recovery for individual file failures

### Week 3: Annotation System

#### Day 1-2: Template System & Metadata Extraction
**Deliverables:**
- [ ] Template-based annotation generation
- [ ] Language-specific extractors for TS/JS/Python

**Implementation:**
```typescript
// src/modules/annotator.ts
interface AnnotationTemplate {
  extractSignature(node: ASTNode): string;
  generateSummary(node: ASTNode): string;
  calculateComplexity(node: ASTNode): number;
  extractDependencies(node: ASTNode): string[];
}

class TypeScriptAnnotator implements AnnotationTemplate {
  extractSignature(node: ASTNode): string {
    // Extract function/class signatures using Tree-sitter patterns
  }
}
```

#### Day 3: Complexity & Dependency Analysis
**Deliverables:**
- [ ] Cyclomatic complexity calculation
- [ ] Import/dependency extraction
- [ ] Source snippet generation with truncation

**Algorithm Implementation:**
- Classical cyclomatic complexity (1 + decision points)
- Symbol resolution for dependency tracking
- Smart truncation with context preservation

#### Day 4-5: Annotation Command
**Deliverables:**
- [ ] Complete annotate command functionality
- [ ] Incremental updates for changed files
- [ ] Annotation storage in `.astdb/annots/`

### Week 4-5: Embedding & Indexing (Complex Phase)

#### Week 4, Day 1-2: Model Management
**Deliverables:**
- [ ] Secure model download with verification
- [ ] Model caching in `.astdb/models/`
- [ ] Fallback mechanisms for network issues

**Implementation:**
```typescript
// src/modules/downloader.ts
class ModelDownloader {
  async downloadModel(modelUrl: string, checksumUrl: string): Promise<string>;
  async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean>;
  async getCachedModelPath(modelName: string): Promise<string>;
}
```

#### Week 4, Day 3-4: Embedding Integration
**Deliverables:**
- [ ] @xenova/transformers integration
- [ ] Batch processing for embeddings
- [ ] Memory management for large datasets

**Key Implementation:**
```typescript
// src/modules/embedder.ts
class EmbeddingGenerator {
  private model: any;
  
  async initialize(modelPath: string): Promise<void>;
  async generateEmbeddings(texts: string[]): Promise<number[][]>;
  async batchProcess(annotations: Annotation[]): Promise<EmbeddingResult[]>;
}
```

#### Week 4, Day 5: HNSW Index Setup
**Deliverables:**
- [ ] HNSW library integration (pure JS version)
- [ ] Index serialization/deserialization
- [ ] Metadata mapping system

#### Week 5: Embedding Command & Index Operations
**Deliverables:**
- [ ] Complete embed command functionality
- [ ] Incremental updates (upsert mechanism)
- [ ] Index integrity checking
- [ ] Performance optimization

**Critical Performance Targets:**
- Process 1000 annotations in <60s with WASM
- Memory usage scales linearly with dataset size
- Index build for 100k nodes in <10 minutes

### Week 6: Query System & File Watching

#### Day 1-2: Query Processing
**Deliverables:**
- [ ] Vector similarity search
- [ ] Result ranking and scoring
- [ ] Multiple output formats (plain, JSON, markdown)

**Implementation:**
```typescript
// src/modules/retriever.ts
class QueryProcessor {
  async query(intent: string, topK: number): Promise<QueryResult[]>;
  async embedQuery(text: string): Promise<number[]>;
  async searchIndex(queryVector: number[], topK: number): Promise<SearchResult[]>;
  formatResults(results: QueryResult[], format: string): string;
}
```

#### Day 3-4: Query Command & Optimization
**Deliverables:**
- [ ] Complete query command functionality
- [ ] Performance optimization to meet <200ms target
- [ ] Query result caching
- [ ] Debugging and verbose output

#### Day 5: File Watching System
**Deliverables:**
- [ ] Chokidar integration for file watching
- [ ] Debouncing (200ms) and batch processing
- [ ] Live update pipeline (parse→annotate→embed)

### Week 7: MCP Server & VS Code Extension

#### Day 1-2: MCP Server Foundation
**Deliverables:**
- [ ] MCP protocol implementation
- [ ] Server lifecycle management
- [ ] Method handlers for AST queries

**MCP Server Structure:**
```
src/mcp/
├─ server.ts               # Main MCP server
├─ handlers.ts             # Method implementations  
├─ types.ts                # MCP protocol types
└─ client.ts               # Connection management
```

**Core MCP Methods:**
```typescript
// src/mcp/handlers.ts
export const handlers = {
    'querySemanticContext': async (params: any) => {
        const retriever = new SemanticRetriever();
        return retriever.searchByIntent(params.intent, params.maxResults);
    },
    'getFileAST': async (params: any) => {
        const parser = new ASTParser();
        return parser.parseFile(params.filePath);
    }
};
```

#### Day 3-4: VS Code Extension Integration  
**Deliverables:**
- [ ] VS Code extension with MCP client
- [ ] Extension commands and UI integration
- [ ] Settings and configuration management

**Extension Implementation:**
```typescript
// extension/src/activate.ts
export async function activate(context: vscode.ExtensionContext) {
    const mcpManager = new MCPManager();
    await mcpManager.startServer();
    
    context.subscriptions.push(
        vscode.commands.registerCommand('astHelper.queryCodebase', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'What would you like to know about this codebase?'
            });
            const results = await mcpManager.querySemanticContext(query);
            // Display results in output panel or webview
        })
    );
}
    
    const context = await queryASTHelper(prompt);
    const enrichedPrompt = `Context: ${context}\n\nRequest: ${prompt}`;
    
    await vscode.env.clipboard.writeText(enrichedPrompt);
    vscode.window.showInformationMessage('Enriched prompt copied to clipboard');
}
```

#### Day 5: MCP Protocol Testing & Validation
**Deliverables:**
- [ ] MCP protocol compliance testing
- [ ] Tool method validation and response formatting
- [ ] Cross-platform MCP server compatibility testing

**Testing Implementation:**
```typescript
// tests/mcp-integration.test.ts
describe('MCP Server Integration', () => {
  test('querySemanticContext returns proper format', async () => {
    const response = await mcpClient.call('querySemanticContext', {
      intent: 'find authentication methods',
      maxResults: 3
    });
    expect(response).toHaveProperty('matches');
    expect(response.matches).toBeArray();
  });
});
```

### Week 8: Testing & Validation

#### Day 1-2: Test Infrastructure
**Deliverables:**
- [ ] Jest testing framework setup
- [ ] Unit tests for all core modules (>90% coverage)
- [ ] Integration tests for workflows

**Test Categories:**
```typescript
// tests/unit/parser.test.ts
describe('ASTParser', () => {
  test('should parse TypeScript function', async () => {});
  test('should handle malformed syntax', async () => {});
  test('should normalize AST structure', async () => {});
});

// tests/integration/workflow.test.ts  
describe('End-to-End Workflow', () => {
  test('parse -> annotate -> embed -> query', async () => {});
});
```

#### Day 3: Performance & Scale Testing
**Deliverables:**
- [ ] 100k LOC synthetic test repository
- [ ] Performance benchmarking suite
- [ ] Memory usage validation

#### Day 4-5: Cross-platform Testing
**Deliverables:**
- [ ] Windows, macOS, Linux compatibility tests
- [ ] VS Code extension testing across platforms
- [ ] Installation and deployment validation

### Week 9: Build Pipeline & Distribution

#### Day 1-2: CI/CD Setup
**Deliverables:**
- [ ] GitHub Actions workflow for multi-platform builds
- [ ] Automated testing across platforms
- [ ] Release automation with version tagging

**GitHub Actions Workflow:**
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npm run build
```

#### Day 3-4: Native Binary Handling
**Deliverables:**
- [ ] Optional native dependency detection
- [ ] Graceful fallback to pure JS
- [ ] Performance comparison and documentation

#### Day 5: Security & Signing
**Deliverables:**
- [ ] Checksum generation for all artifacts
- [ ] Security scanning integration
- [ ] Signing infrastructure (if available)

### Week 10: Documentation & Launch

#### Day 1-3: Comprehensive Documentation
**Deliverables:**
- [ ] README with installation and quick start
- [ ] Configuration guide with examples
- [ ] Troubleshooting and FAQ
- [ ] API documentation

**Documentation Structure:**
```
docs/
├─ README.md                # Main documentation
├─ INSTALLATION.md          # Platform-specific setup
├─ CONFIGURATION.md         # Configuration options
├─ TROUBLESHOOTING.md       # Common issues
├─ API.md                   # Developer API
└─ EXAMPLES.md              # Usage examples
```

#### Day 4-5: Final Validation & Release
**Deliverables:**
- [ ] Complete security audit
- [ ] Performance target validation
- [ ] Cross-platform installation testing
- [ ] NPM package preparation
- [ ] VS Code marketplace submission

## Implementation Milestones & Success Criteria

### Milestone 1 (Week 2): Basic Parsing
- [ ] Parse 1000+ TypeScript files successfully
- [ ] Git integration working across platforms
- [ ] AST storage and retrieval functional

### Milestone 2 (Week 3): Annotation System
- [ ] Generate meaningful annotations for TS/JS/Python
- [ ] Template system extensible to new languages
- [ ] Incremental updates working correctly

### Milestone 3 (Week 5): Embedding & Indexing  
- [ ] Index 10k+ code fragments
- [ ] Query latency <500ms for development
- [ ] Memory usage linear with dataset size

### Milestone 4 (Week 7): MCP Server & VS Code Extension
- [ ] Extension functional with Copilot workflow
- [ ] Proper error handling and user feedback
- [ ] Configuration UI working

### Milestone 5 (Week 8): Performance Validation
- [ ] Index 100k LOC in <10 minutes
- [ ] Query latency <200ms average
- [ ] Memory usage <4GB for large repositories

### Final Milestone (Week 10): Production Ready
- [ ] All performance targets met
- [ ] Cross-platform compatibility verified
- [ ] Documentation complete
- [ ] Security audit passed

## Risk Mitigation Strategies

### High-Risk Items
1. **Performance Targets**: Begin performance testing early, have fallback optimizations ready
2. **Model Integration**: Test embedding generation early, have backup model options
3. **Cross-platform Issues**: Test on all platforms throughout development
4. **VS Code Integration**: Have multiple integration strategies prepared

### Technical Debt Management
- Prioritize functionality over optimization in early phases
- Plan refactoring windows after major milestones
- Maintain comprehensive test coverage to enable safe refactoring
- Document technical debt decisions for future resolution

## Development Resources & Prerequisites

### Required Skills
- TypeScript/Node.js development
- VS Code extension development  
- Git and file system operations
- Vector databases and machine learning basics
- Cross-platform development experience

### Development Environment
- Node.js 18+ with TypeScript
- VS Code with extension development tools
- Git repository with sample codebases
- Testing environments for Windows/macOS/Linux

### External Dependencies
- Tree-sitter grammar availability
- CodeBERT-base model downloaded from HuggingFace
- GitHub Actions/CI availability
- NPM and VS Code marketplace access

This implementation specification provides a concrete roadmap for building the ast-copilot-helper system. Each week has specific deliverables and success criteria, making it possible to track progress and adjust timelines as needed.
