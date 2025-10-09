# Actionable Cleanup Tasks

**Generated:** October 8, 2025  
**Updated:** Comprehensive review pass  
**Purpose:** Detailed, actionable cleanup tasks with exact file locations, line numbers, and code examples

---

## Executive Summary

After systematic verification, we found **16 false positives** where functionality exists but is poorly documented or connected. This document provides **10 specific cleanup tasks** to fix these issues.

**Total Estimated Effort:** 8-12 hours

### Cleanup Categories

1. **Remove Misleading TODOs** - Delete outdated TODO comments (3 tasks)
2. **Connect CLI Handlers** - Wire up stub handlers to actual implementations (2 tasks)
3. **Update Documentation** - Fix incorrect feature status reports (1 task)
4. **Add Missing CLI Flags** - Expose existing functionality through CLI (1 task)
5. **Integration Work** - Connect existing implementations (3 tasks)

---

## 1. Critical Cleanups (Remove Misleading TODOs)

### 1.1 Clean up Rust `core.rs` Stubs

**File:** `packages/ast-core-engine/src/core.rs`

**Issue:** Contains misleading TODO stubs suggesting VectorDatabase, ASTProcessor, and BatchProcessor are unimplemented, when they actually exist in separate module files.

**Action:** Remove or update the stubs to re-export actual implementations

**Specific Changes:**

```rust
// Option 1: Remove the placeholder structs entirely
// Delete lines with: pub struct VectorDatabase, pub struct ASTProcessor, pub struct BatchProcessor

// Option 2: Re-export actual implementations
pub use crate::vector_db::SimpleVectorDb as VectorDatabase;
pub use crate::ast_processor::AstProcessor as ASTProcessor;
pub use crate::batch_processor::BatchProcessor;

// Remove all TODO comments that say:
// "TODO: Implement vector database for similarity search"
// "TODO: Implement AST processing with Tree-sitter"
// "TODO: Implement batch file processing"
```

**Files to Edit:**

- `packages/ast-core-engine/src/core.rs` - Remove/update stubs
- `packages/ast-core-engine/src/lib.rs` - Verify proper exports already exist

**Verification:**

```bash
# Should show proper exports
grep -n "pub use" packages/ast-core-engine/src/lib.rs
```

---

### 1.2 Remove CACHE_CLI_COMMANDS.md Placeholder Warnings

**File:** `CACHE_CLI_COMMANDS.md`

**Issue:** Document contains placeholder warnings claiming cache:warm, cache:prune, cache:analyze are not implemented in standalone CLI, but they ARE fully implemented.

**Action:** Remove all placeholder warnings and update status to "Implemented"

**Specific Lines to Remove/Update:**

Lines 215-224:

```markdown
⚠️ Placeholder Command: This command requires MCP server integration
ℹ Cache warming is not yet implemented in standalone CLI mode.
```

Lines 273-282:

```markdown
⚠️ Placeholder Command: This command requires database access
ℹ Cache pruning is not yet implemented in standalone CLI mode.
```

Lines 339-345:

```markdown
⚠️ Placeholder Command: This command requires runtime statistics from MCP server
ℹ Cache analysis is not yet implemented in standalone CLI mode.
```

**Replace with:**

```markdown
✅ Implemented: This command is fully functional in standalone CLI mode
ℹ Uses QueryCache and QueryLog for cache management
```

**Verification:**

```bash
# Test the commands work
ast-helper cache:warm --dry-run
ast-helper cache:prune --older-than 7d --dry-run
ast-helper cache:analyze
```

---

### 1.3 Update FEATURE_STATUS_REPORT.md

**File:** `FEATURE_STATUS_REPORT.md`

**Issue:** Lines 608, 613, 618 incorrectly state MCP resources are "defined but no implementation"

**Action:** Update status to "Fully Implemented"

**Specific Changes:**

Line 608:

```markdown
<!-- OLD -->

- **Status:** Resource defined but no implementation

<!-- NEW -->

- **Status:** ✅ Fully Implemented (handleNodesResource at line 445 of resources.ts)
```

Line 613:

```markdown
<!-- OLD -->

- **Status:** Resource defined but no implementation

<!-- NEW -->

- **Status:** ✅ Fully Implemented (handleFilesResource at line 491 of resources.ts)
```

Line 618:

```markdown
<!-- OLD -->

- **Status:** Resource defined but no implementation

<!-- NEW -->

- **Status:** ✅ Fully Implemented (handleSearchResource at line 589 of resources.ts)
```

---

## 2. High Priority Cleanups (Connect Handlers)

### 2.1 Connect Watch Command CLI Handler

**File:** `packages/ast-helper/src/cli.ts`

**Issue:** Lines 1844-1858 contain a stub `WatchCommandHandler` with TODO, but actual `WatchCommand` class exists in `watch.ts` (945 lines)

**Action:** Update handler to instantiate and use actual WatchCommand implementation

**Specific Changes:**

Replace lines 1844-1858:

```typescript
// OLD CODE
class WatchCommandHandler implements CommandHandler<WatchOptions> {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    console.log("Watch command executed with options:", options);
    console.log("Using config:", {
      outputDir: config.outputDir,
      watchGlob: config.watchGlob,
    });
    // TODO: Implement actual watch logic
  }
}
```

With:

```typescript
// NEW CODE
class WatchCommandHandler implements CommandHandler<WatchOptions> {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    const { WatchCommand } = await import("./commands/watch.js");

    // Map CLI options to WatchCommand options
    const watchOptions = {
      glob: options.glob || config.watchGlob,
      debounce: options.debounce,
      includeAnnotation: options.annotation,
      batch: options.batch,
      recursive: options.recursive,
      followSymlinks: options.followSymlinks,
    };

    const watchCommand = new WatchCommand(config, watchOptions);

    // Set up signal handlers for graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n\nShutting down watch command...");
      await watchCommand.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await watchCommand.stop();
      process.exit(0);
    });

    // Start watching
    await watchCommand.start();
  }
}
```

**Verification:**

```bash
# Test watch command
ast-helper watch --glob "**/*.ts" --debounce 500
```

---

### 2.2 Add Missing Embed Command CLI Flags

**File:** `packages/ast-helper/src/cli.ts`

**Issue:** Lines 1822-1823 hardcode `force: false` and `dryRun: false` with TODOs, but EmbedCommand already supports these options

**Action:** Add --force and --dry-run flags to embed command CLI definition

**Specific Changes:**

In `setupEmbedCommand()` method (around line 463-490), add options:

```typescript
private setupEmbedCommand(): void {
  this.program
    .command("embed")
    .description("Generate vector embeddings for annotations")
    .addOption(
      new Option("-c, --changed", "Process only changed annotations"),
    )
    .addOption(
      new Option("--model <name>", "Embedding model to use").default(
        "codebert-base",
      ),
    )
    .addOption(
      new Option("--batch-size <n>", "Batch size for embedding generation")
        .default(32)
        .argParser((value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > 1000) {
            throw new Error("--batch-size must be between 1 and 1000");
          }
          return num;
        }),
    )
    // ADD THESE TWO OPTIONS:
    .addOption(
      new Option("-f, --force", "Force re-embedding existing annotations").default(false),
    )
    .addOption(
      new Option("--dry-run", "Show what would be done without actually embedding").default(false),
    )
    .action(async (options: EmbedOptions) => {
      await this.executeCommand("embed", options);
    });
}
```

Then update the handler (lines 1810-1825) to pass these options:

```typescript
// OLD
const commandOptions = {
  input: options.changed ? undefined : options.workspace,
  model: options.model,
  batchSize: options.batchSize,
  verbose: true,
  force: false, // TODO: Add --force flag to CLI options
  dryRun: false, // TODO: Add --dry-run flag to CLI options
};

// NEW
const commandOptions = {
  input: options.changed ? undefined : options.workspace,
  model: options.model,
  batchSize: options.batchSize,
  verbose: true,
  force: options.force || false,
  dryRun: options.dryRun || false,
};
```

**Verification:**

```bash
# Test new flags
ast-helper embed --dry-run
ast-helper embed --force --model codebert-base
```

---

### 2.3 Integrate Marketplace Publisher into Orchestrator

**File:** `packages/ast-helper/src/distribution/orchestrator.ts`

**Issue:** Line 58 has commented-out code to initialize VSCodeMarketplacePublisher, even though marketplace-publisher.ts is fully complete (1034 lines, no TODOs)

**Action:** Uncomment and integrate the marketplace publisher

**Specific Changes:**

Around line 58, uncomment:

```typescript
// OLD (commented out)
// TODO: Uncomment when VS Code marketplace publisher is implemented
// const vsCodePublisher = new VSCodeMarketplacePublisher();
// await vsCodePublisher.initialize(config);
// this.publishers.set('marketplace', vsCodePublisher);

// NEW (uncommented)
const { MarketplacePublisher } = await import("./marketplace-publisher.js");
const vsCodePublisher = new MarketplacePublisher();
await vsCodePublisher.initialize(config);
this.publishers.set("marketplace", vsCodePublisher);
```

**Verification:**

```bash
# Test marketplace publisher initialization
ast-helper distribute --target vscode-extension --dry-run
```

---

### 2.4 Integrate Query Benchmarks into PerformanceBenchmarkRunner

**File:** `packages/ast-helper/src/performance/benchmark-runner.ts`

**Issue:** Lines 356-380 have stub methods returning empty arrays, but `QueryBenchmarkRunner` class exists with full implementations

**Action:** Import and use QueryBenchmarkRunner in the stub methods

**Specific Changes:**

Add import at top of file:

```typescript
import { QueryBenchmarkRunner } from "./query-benchmarks.js";
```

Update stub methods (lines 356-380):

```typescript
// OLD
private async runQueryBenchmarks(): Promise<QueryBenchmark[]> {
  console.log("Query benchmarks - placeholder implementation");
  // TODO: Implement actual query benchmarks
  return [];
}

// NEW
private async runQueryBenchmarks(): Promise<QueryBenchmark[]> {
  const queryRunner = new QueryBenchmarkRunner();
  const config = {
    queryTypes: ['file', 'ast', 'semantic'] as QueryType[],
    nodeCounts: [100, 1000, 10000] as NodeCount[],
    iterations: 5,
    warmupRuns: 2,
  };

  try {
    const result = await queryRunner.runQueryBenchmarks(config);

    // Convert BenchmarkResult to QueryBenchmark[] format
    return result.runs.map(run => ({
      type: run.subtype as any,
      nodeCount: run.nodeCount || 0,
      duration: run.duration,
      success: run.success,
      cpuUsage: run.cpuUsage,
      memoryUsage: run.memoryUsage,
    }));
  } catch (error) {
    console.error("Query benchmarks failed:", error);
    return [];
  }
}
```

**Note:** Similar integration needed for other benchmark methods if implementations exist for parsing, embedding, vector search, and system benchmarks.

---

## 3. Medium Priority Cleanups (Documentation)

### 3.1 Update Model Version Tracking

**File:** `packages/ast-helper/src/commands/embed.ts`

**Issue:** Line 477 hardcodes version as "1.0.0" with TODO

**Action:** Get actual model version from EmbeddingGenerator

**Specific Changes:**

```typescript
// OLD
version: "1.0.0", // TODO: Get actual model version

// NEW
version: await generator.getModelVersion() || "1.0.0",
```

Then add method to EmbeddingGenerator interface:

```typescript
interface EmbeddingGenerator {
  // ... existing methods
  getModelVersion?(): Promise<string>;
}
```

---

### 3.2 Add Cache Config to Config Type

**File:** `packages/ast-helper/src/commands/query.ts`

**Issue:** Line 196 hardcodes `cacheEnabled = true` with TODO about adding to Config type

**Action:** Add cache configuration to Config interface

**Files to Update:**

1. `packages/ast-helper/src/types.ts` - Add to Config interface:

```typescript
export interface Config {
  // ... existing fields
  cache?: {
    enabled?: boolean;
    cacheDir?: string;
    maxSize?: number;
  };
}
```

2. `packages/ast-helper/src/commands/query.ts` line 196:

```typescript
// OLD
const cacheEnabled = true; // TODO: Add cache config to Config type

// NEW
const cacheEnabled = config.cache?.enabled ?? true;
```

---

### 3.3 Implement Git Ahead/Behind Tracking

**File:** `packages/ast-helper/src/git/manager.ts`

**Issue:** Line 460 hardcodes `ahead: 0` with TODO

**Action:** Implement proper ahead/behind calculation using git commands

**Specific Changes:**

```typescript
// OLD
ahead: 0, // TODO: implement proper ahead/behind tracking

// NEW
ahead: await this.getAheadCount(branchName),
```

Add helper method:

```typescript
private async getAheadCount(branchName: string): Promise<number> {
  try {
    const result = execSync(
      `git rev-list --count @{u}..HEAD`,
      { cwd: this.repoPath, encoding: 'utf-8' }
    );
    return parseInt(result.trim()) || 0;
  } catch (error) {
    // Branch might not have upstream
    return 0;
  }
}
```

---

## 4. Low Priority Cleanups (Informational TODOs)

### 4.1 Add Database Module Exports

**File:** `packages/ast-helper/src/database/index.ts`

**Issue:** Line 19 has TODO about adding other database modules

**Action:** Review and add any missing exports

**Verification:**

```bash
# List all database modules
find packages/ast-helper/src/database -name "*.ts" -not -name "*.test.ts" -not -name "index.ts"

# Compare with exports in index.ts
grep "export" packages/ast-helper/src/database/index.ts
```

---

### 4.2 Add Proxy Support to Model Downloader

**File:** `packages/ast-helper/src/models/downloader.ts`

**Issue:** Line 474 has TODO for proxy support

**Action:** Add proxy configuration options

**Specific Changes:**

```typescript
// Add to fetch options
const fetchOptions: RequestInit = {
  method: "GET",
  headers: {
    "User-Agent": "ast-copilot-helper",
  },
  // Add proxy support
  ...(process.env.HTTP_PROXY || process.env.HTTPS_PROXY
    ? {
        // Node fetch uses environment variables automatically
        // or use an agent for more control
      }
    : {}),
};
```

---

## 5. Cleanup Verification Checklist

After completing cleanups, verify with these commands:

### Search for Remaining False Positive TODOs

```bash
# Should find no matches for these specific patterns
grep -r "TODO: Implement actual watch logic" packages/
grep -r "TODO: Uncomment when VS Code marketplace publisher" packages/
grep -r "Placeholder Command: This command requires MCP server integration" .
```

### Test Updated Commands

```bash
# Watch command
ast-helper watch --help
ast-helper watch --glob "**/*.ts" --debounce 500 &
WATCH_PID=$!
sleep 5
kill $WATCH_PID

# Embed command with new flags
ast-helper embed --help | grep -E "force|dry-run"
ast-helper embed --dry-run

# Cache commands
ast-helper cache:warm --count 10 --verbose
ast-helper cache:prune --older-than 7d --dry-run
ast-helper cache:analyze --top-queries 20
```

### Verify Rust Exports

```bash
cd packages/ast-core-engine
cargo check
grep -A 3 "pub use" src/lib.rs
```

### Run Full Test Suite

```bash
yarn test
cargo test --package ast-core-engine
```

---

---

## Task 1: Remove Misleading Rust Core Engine TODOs

**Priority:** HIGH  
**Effort:** 1-2 hours  
**Files:** `packages/ast-core-engine/src/core.rs`

### Problem

Lines 5-40 contain stub functions with TODO comments that mislead developers into thinking VectorDatabase, ASTProcessor, and BatchProcessor are unimplemented. The actual implementations exist in separate modules:

- `src/vector_db.rs` (186 lines) - SimpleVectorDb
- `src/ast_processor.rs` (522 lines) - AstProcessor
- `src/batch_processor.rs` (646 lines) - BatchProcessor

### Required Action

**Option A (Recommended):** Remove stubs entirely from `core.rs` and add comment explaining where implementations are.

**Option B:** Re-export actual implementations:

```rust
pub use vector_db::SimpleVectorDb as VectorDatabase;
pub use ast_processor::AstProcessor as ASTProcessor;
pub use batch_processor::BatchProcessor;
```

### Verification Command

```bash
cd packages/ast-core-engine
cargo check
grep -n "pub use" src/lib.rs
```

---

## Task 2: Wire Up WatchCommand in CLI Handler

**Priority:** HIGH  
**Effort:** 30 minutes  
**Files:** `packages/ast-helper/src/cli.ts` (lines 1844-1858)

### Problem

CLI handler stub doesn't use the actual WatchCommand class that exists in `watch.ts` (945 lines).

### Current Code

```typescript
// Lines 1844-1858
class WatchCommandHandler implements CommandHandler {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    const logger = await this.initializeLogger(config);
    logger.info("Watch command - placeholder implementation");
    // TODO: Implement watch command using WatchCommand class
  }
}
```

### Required Change

```typescript
import { WatchCommand } from "./commands/watch.js";

class WatchCommandHandler implements CommandHandler {
  async execute(options: WatchOptions, config: Config): Promise<void> {
    const logger = await this.initializeLogger(config);
    const watchCommand = new WatchCommand(config, logger, options);
    await watchCommand.execute();
  }

  private async initializeLogger(config: Config): Promise<Logger> {
    return new Logger(config.logLevel || LogLevel.INFO);
  }
}
```

### Verification Command

```bash
./bin/ast-copilot-helper watch --help
./bin/ast-copilot-helper watch ./test-dir
```

---

## Task 3: Add Missing CLI Flags for Embed Command

**Priority:** MEDIUM  
**Effort:** 15 minutes  
**Files:** `packages/ast-helper/src/cli.ts` (lines 463-490, 1822-1823)

### Problem

EmbedCommand supports `--force` and `--dry-run` but CLI doesn't expose them.

### Required Change in setupEmbedCommand() (line 463)

```typescript
.addOption(new Option("--force", "Force re-embedding existing annotations"))
.addOption(new Option("--dry-run", "Validate configuration without embedding"))
```

### Required Change in EmbedCommandHandler (lines 1822-1823)

```typescript
force: options.force ?? false,
dryRun: options.dryRun ?? false,
```

### Verification Command

```bash
./bin/ast-copilot-helper embed --help | grep -E "(--force|--dry-run)"
./bin/ast-copilot-helper embed --dry-run
```

---

## Task 4: Update CACHE_CLI_COMMANDS.md Documentation

**Priority:** MEDIUM  
**Effort:** 15 minutes  
**Files:** `CACHE_CLI_COMMANDS.md` (lines 215-224, 273-282, 339-345)

### Problem

Documentation has "⚠️ Placeholder" warnings but commands are fully implemented in `cache.ts`.

### Required Changes

Replace all three placeholder warnings with:

```markdown
✅ **Implementation Status**: The `cache:warm` command is fully implemented.
Implementation: `packages/ast-helper/src/commands/cache.ts` lines 254-322.
```

Do similar for `cache:prune` (lines 340-390) and `cache:analyze` (lines 400-600).

### Verification Command

```bash
./bin/ast-copilot-helper cache:warm --count 10 --dry-run
./bin/ast-copilot-helper cache:analyze
```

---

## Task 5: Integrate QueryBenchmarkRunner into PerformanceBenchmarkRunner

**Priority:** MEDIUM  
**Effort:** 2-3 hours  
**Files:** `packages/ast-helper/src/performance/benchmark-runner.ts` (line 360)

### Problem

QueryBenchmarkRunner exists (756 lines) but isn't used. Method returns empty array.

### Required Change

```typescript
import { QueryBenchmarkRunner } from "./query-benchmarks.js";

private async runQueryBenchmarks(): Promise<QueryBenchmark[]> {
  const queryRunner = new QueryBenchmarkRunner();
  const config = {
    queryTypes: ["file", "ast", "semantic"] as const,
    nodeCounts: [100, 1000, 10000] as const,
    iterations: 5,
    warmupRuns: 2,
  };

  const result = await queryRunner.runQueryBenchmarks(config);

  return result.runs.map(run => ({
    queryType: run.subtype,
    nodeCount: run.metadata?.nodeCount ?? 0,
    duration: run.duration,
    cpuUsage: run.cpuUsage,
    memoryUsage: run.memoryUsage,
    meetsMCPTarget: run.duration < 200,
    meetsCLITarget: run.duration < 500,
  }));
}
```

### Verification Command

```bash
npm run test:performance
./bin/ast-copilot-helper benchmark --type query
```

---

## Task 6: Uncomment Marketplace Publisher in Orchestrator

**Priority:** LOW  
**Effort:** 5 minutes  
**Files:** `packages/ast-helper/src/distribution/orchestrator.ts` (line 58)

### Problem

Comment says to uncomment when implemented, but implementation is complete (1034 lines, 0 TODOs).

### Required Change

```typescript
// Remove TODO comment and uncomment:
const marketplacePublisher = new MarketplacePublisher(config);
await marketplacePublisher.publish();
```

### Verification Command

```bash
npm run publish:vscode -- --dry-run
```

---

## Task 7: Add Model Version Tracking

**Priority:** LOW  
**Effort:** 1 hour  
**Files:** `packages/ast-helper/src/commands/embed.ts` (line 477)

### Problem

Model version hardcoded to "1.0.0".

### Required Changes

In `embed.ts` line 477:

```typescript
version: this.generator?.getModelVersion() ?? "1.0.0",
```

Add to `XenovaEmbeddingGenerator`:

```typescript
public getModelVersion(): string {
  return this.pipeline?.model?.config?.model_version ?? "1.0.0";
}
```

### Verification Command

```bash
./bin/ast-copilot-helper embed --verbose | grep "Model version"
```

---

## Task 8: Implement Git Ahead/Behind Tracking

**Priority:** LOW  
**Effort:** 1-2 hours  
**Files:** `packages/ast-helper/src/git/manager.ts` (line 460)

### Problem

Hardcoded to 0 instead of using `git rev-list`.

### Required Change

```typescript
// Get upstream branch
const upstream = await this.execGit(repositoryRoot, [
  "rev-parse",
  "--abbrev-ref",
  `${currentBranch}@{upstream}`,
]);

let ahead = 0,
  behind = 0;
if (upstream) {
  const aheadResult = await this.execGit(repositoryRoot, [
    "rev-list",
    "--count",
    `${upstream}..${currentBranch}`,
  ]);
  ahead = parseInt(aheadResult.trim()) || 0;

  const behindResult = await this.execGit(repositoryRoot, [
    "rev-list",
    "--count",
    `${currentBranch}..${upstream}`,
  ]);
  behind = parseInt(behindResult.trim()) || 0;
}
```

### Verification Command

```bash
git status  # Note ahead/behind count
./bin/ast-copilot-helper status  # Should match
```

---

## Task 9: Add Cache Configuration to Config Type

**Priority:** LOW  
**Effort:** 30 minutes  
**Files:** `packages/ast-helper/src/commands/query.ts` (line 196), `src/config/types.ts`

### Problem

Cache enabled flag is hardcoded.

### Required Changes

Add to Config interface:

```typescript
cache?: {
  enabled?: boolean;
  cacheDir?: string;
  l1MaxEntries?: number;
  l2MaxSizeMB?: number;
  defaultTTL?: number;
};
```

Update query.ts line 196:

```typescript
const cacheEnabled = this.config.cache?.enabled ?? true;
```

### Verification Command

```bash
./bin/ast-copilot-helper query "test" --config '{"cache":{"enabled":false}}'
```

---

## Task 10: Export Additional Database Modules

**Priority:** LOW  
**Effort:** 15 minutes  
**Files:** `packages/ast-helper/src/database/index.ts` (line 19)

### Problem

Comment suggests more modules should be exported.

### Required Action

```bash
# Audit what's in database directory
ls packages/ast-helper/src/database/*.ts
```

Add missing exports after line 19:

```typescript
export { QueryCache } from "./query-cache.js";
export { VectorDatabaseFactory } from "./vector/factory.js";
```

### Verification Command

```bash
node -e "const db = require('./dist/database/index.js'); console.log(Object.keys(db));"
npm run test -- database
```

---

## Summary of Impact

### Files to Modify

1. `packages/ast-core-engine/src/core.rs` - Remove misleading stubs
2. `packages/ast-helper/src/cli.ts` - Connect watch handler, add embed flags
3. `packages/ast-helper/src/distribution/orchestrator.ts` - Uncomment marketplace publisher
4. `packages/ast-helper/src/performance/benchmark-runner.ts` - Integrate QueryBenchmarkRunner
5. `CACHE_CLI_COMMANDS.md` - Remove placeholder warnings
6. `FEATURE_STATUS_REPORT.md` - Update MCP resources status
7. `packages/ast-helper/src/commands/embed.ts` - Get actual model version
8. `packages/ast-helper/src/commands/query.ts` - Use cache config from Config
9. `packages/ast-helper/src/types.ts` - Add cache config to interface
10. `packages/ast-helper/src/git/manager.ts` - Implement ahead/behind tracking

### Estimated Effort by Task

1. **Remove Rust Core Engine TODOs:** 1-2 hours
2. **Wire Up WatchCommand:** 30 minutes
3. **Add Embed CLI Flags:** 15 minutes
4. **Update CACHE_CLI_COMMANDS.md:** 15 minutes
5. **Integrate QueryBenchmarkRunner:** 2-3 hours
6. **Uncomment Marketplace Publisher:** 5 minutes
7. **Add Model Version Tracking:** 1 hour
8. **Git Ahead/Behind Tracking:** 1-2 hours
9. **Add Cache Config:** 30 minutes
10. **Export Database Modules:** 15 minutes

**Testing and Verification:** 1-2 hours  
**Total:** 8-12 hours of development work

### Benefits

1. **Remove confusion** - Eliminate 16 misleading TODOs pointing to implemented features
2. **Expose functionality** - Surface existing features through proper CLI interfaces
3. **Improve accuracy** - Reduce critical gap count from 13 to 2 (85% reduction)
4. **Enable features** - Activate marketplace publisher, performance benchmarks, CLI flags
5. **Better developer experience** - Clear documentation, accurate status reports
6. Improve code maintainability and documentation accuracy
7. Reduce false positives in future audits
8. Make the codebase more contributor-friendly
