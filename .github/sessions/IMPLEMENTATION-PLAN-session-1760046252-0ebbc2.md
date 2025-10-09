# Implementation Plan - Session 1760046252-0ebbc2

**Issues**: #169, #170, #171  
**Strategy**: Network approach (#170 → #171 → #169)  
**Date**: 2025-01-09

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Order Rationale](#implementation-order-rationale)
3. [Issue #170: MCP Config Schema](#issue-170-mcp-config-schema)
4. [Issue #171: XDG User Config Paths](#issue-171-xdg-user-config-paths)
5. [Issue #172: HNSW Corruption Detection](#issue-169-hnsw-corruption-detection)
6. [Testing Strategy](#testing-strategy)
7. [Risk Mitigation](#risk-mitigation)
8. [Success Criteria](#success-criteria)

---

## Overview

This implementation plan provides a detailed, file-by-file guide for implementing three Sprint 3 enhancements:

- **Issue #170**: Add MCP configuration section to config schema
- **Issue #171**: Support XDG Base Directory paths for user configuration
- **Issue #169**: Add HNSW index corruption detection and auto-rebuild

**Total Estimated Effort**: 12-18 hours  
**Implementation Approach**: Network (resolve foundation issues first, then build on them)

---

## Implementation Order Rationale

### Phase 1: Issue #170 (2-3 hours)

**Why First**: Foundation for configuration system improvements.

- Adds MCP section to config schema
- No dependencies on other issues
- Simple schema addition with validation
- Low risk, high confidence
- Enables MCP server configuration in later development

### Phase 2: Issue #171 (2-4 hours)

**Why Second**: Builds on config system from #170.

- Adds XDG path discovery to config system
- Benefits from having complete config schema (#170)
- Enables user-level configuration
- Moderate complexity, well-defined scope
- Required for future user customization features

### Phase 3: Issue #169 (6-8 hours)

**Why Last**: Most complex, builds on stable config foundation.

- Adds corruption detection to HNSW database
- Benefits from stable config system (#170, #171)
- Most complex implementation
- Requires comprehensive testing
- Higher risk, needs solid foundation

---

## Issue #170: MCP Config Schema

### **Priority**: P1 (Foundation)

### **Estimated Effort**: 2-3 hours

### **Risk Level**: Low

### Acceptance Criteria

- ✅ **AC-170-1**: Config interface includes `mcp` section
- ✅ **AC-170-2**: MCP section includes `port` (number, 1024-65535)
- ✅ **AC-170-3**: MCP section includes `autoStart` (boolean)
- ✅ **AC-170-4**: Validation rejects invalid port numbers
- ✅ **AC-170-5**: Example config.json documents MCP section
- ✅ **AC-170-6**: 5-8 unit tests for MCP config validation

### Files to Modify

#### 1. **packages/ast-helper/src/types.ts** (PRIMARY)

**Current State**:

- Lines 1-220: Core `Config` interface with ~13 sections
- Uses JSDoc comments for documentation
- Follows consistent pattern: optional sections with nested required properties

**Changes Required**:

```typescript
// Add after line ~108 (after cache section, before CLI options)

/** MCP (Model Context Protocol) server configuration */
mcp?: {
  /** MCP server port (1024-65535) */
  port: number;
  /** Auto-start MCP server with CLI */
  autoStart: boolean;
};
```

**Also Update PartialConfig** (line ~115):

```typescript
// Add to PartialConfig type after cache section
mcp: Partial<{
  port: number;
  autoStart: boolean;
}>;
```

**Testing Impact**: Minimal - type-only changes  
**Breaking Changes**: None - optional section

---

#### 2. **packages/ast-helper/src/config/defaults.ts**

**Current State**:

- Exports `DEFAULT_CONFIG` constant
- Uses `validateConfig()` function
- Pattern: Nested objects with sensible defaults

**Changes Required**:

```typescript
// Add to DEFAULT_CONFIG object (around line 40-50)
mcp: {
  port: 3000,
  autoStart: false,
},
```

**Rationale**:

- Port 3000: Common development port, avoids privileged ports (<1024)
- autoStart false: Explicit opt-in for server startup

**Testing Impact**: Update config default tests  
**Breaking Changes**: None - new optional section

---

#### 3. **packages/ast-helper/src/config/validation-schema.ts**

**Current State**:

- Exports `CONFIG_VALIDATION_SCHEMA` constant
- Uses `ValidationUtils` for common patterns
- Pattern: One validation rule per config property

**Changes Required**:

```typescript
// Add to CONFIG_VALIDATION_SCHEMA object (around line 80-100)
mcp: {
  port: {
    validate: (value: any) => {
      if (typeof value !== 'number') {
        return 'mcp.port must be a number';
      }
      if (value < 1024 || value > 65535) {
        return 'mcp.port must be between 1024 and 65535 (privileged ports not allowed)';
      }
      return true;
    },
    suggestion: 'Use a port number between 1024 and 65535 (e.g., 3000, 8080)',
    example: 3000,
  },
  autoStart: {
    validate: (value: any) => {
      if (typeof value !== 'boolean') {
        return 'mcp.autoStart must be a boolean';
      }
      return true;
    },
    suggestion: 'Use true to auto-start MCP server, false to start manually',
    example: false,
  },
},
```

**Validation Logic**:

- Port: Must be number, range 1024-65535 (avoids privileged ports)
- autoStart: Must be boolean
- Follows existing pattern with detailed error messages

**Testing Impact**: Add validation tests  
**Breaking Changes**: None - validates new optional section

---

#### 4. **packages/ast-helper/src/config/manager.ts**

**Current State**:

- Lines 1-150: `ConfigManager` class
- `mergeConfigs()` method merges partial configs
- Pattern: Explicit property checks for each config section

**Changes Required**:

```typescript
// Add to mergeConfigs() method after cache section merge (around line 110-120)

// Merge nested mcp object
if (source.mcp) {
  if (!result.mcp) {
    result.mcp = {};
  }
  if (source.mcp.port !== undefined) {
    result.mcp.port = source.mcp.port;
  }
  if (source.mcp.autoStart !== undefined) {
    result.mcp.autoStart = source.mcp.autoStart;
  }
}
```

**Rationale**: Follows existing pattern for nested object merging  
**Testing Impact**: Test config merge with MCP section  
**Breaking Changes**: None - handles new optional section

---

#### 5. **examples/config.json** (CREATE NEW)

**Current State**: `examples/` directory is empty

**Create File**: `examples/config.json`

```json
{
  "$schema": "../packages/ast-helper/config-schema.json",
  "parseGlob": ["src/**/*.ts", "src/**/*.js"],
  "watchGlob": ["src/**/*.ts"],
  "outputDir": ".astdb",
  "topK": 10,
  "snippetLines": 5,
  "indexParams": {
    "efConstruction": 200,
    "M": 16
  },
  "modelHost": "https://huggingface.co",
  "model": {
    "defaultModel": "codebert-base",
    "modelsDir": ".astdb/models",
    "downloadTimeout": 300000,
    "maxConcurrentDownloads": 3,
    "showProgress": true
  },
  "enableTelemetry": false,
  "concurrency": 4,
  "batchSize": 1000,
  "mcp": {
    "port": 3000,
    "autoStart": false
  },
  "cache": {
    "enabled": true,
    "maxCacheSize": 100,
    "cacheTTL": 3600,
    "enableCompression": true
  }
}
```

**Purpose**:

- Provides complete, working example configuration
- Documents all available options including new MCP section
- Shows sensible defaults and common patterns

**Testing Impact**: Use in integration tests  
**Breaking Changes**: None - new file

---

#### 6. **README.md** or **docs/configuration.md**

**Changes Required**: Add MCP configuration section to documentation

````markdown
### MCP Server Configuration

Configure the Model Context Protocol (MCP) server:

```json
{
  "mcp": {
    "port": 3000,
    "autoStart": false
  }
}
```
````

**Options**:

- `port` (number): MCP server port (1024-65535). Default: 3000
- `autoStart` (boolean): Auto-start server with CLI. Default: false

````

**Location**: Add to configuration documentation section
**Testing Impact**: None - documentation only
**Breaking Changes**: None

---

### Testing Requirements

#### Unit Tests (5-8 tests)

**File**: `packages/ast-helper/src/config/__tests__/mcp-config.test.ts` (NEW)

```typescript
describe('MCP Configuration', () => {
  describe('Schema Validation', () => {
    test('accepts valid MCP config with port and autoStart', () => {
      const config = { mcp: { port: 3000, autoStart: false } };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    test('rejects port below 1024', () => {
      const config = { mcp: { port: 80, autoStart: false } };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('mcp.port');
    });

    test('rejects port above 65535', () => {
      const config = { mcp: { port: 70000, autoStart: false } };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    test('accepts valid port range (1024-65535)', () => {
      const ports = [1024, 3000, 8080, 65535];
      ports.forEach(port => {
        const config = { mcp: { port, autoStart: true } };
        const result = validateConfig(config);
        expect(result.valid).toBe(true);
      });
    });

    test('rejects non-number port', () => {
      const config = { mcp: { port: '3000', autoStart: false } };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    test('rejects non-boolean autoStart', () => {
      const config = { mcp: { port: 3000, autoStart: 'yes' } };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    test('applies defaults when MCP section omitted', () => {
      const config = {};
      const validated = validateConfig(config);
      expect(validated.mcp.port).toBe(3000);
      expect(validated.mcp.autoStart).toBe(false);
    });

    test('merges MCP config from multiple sources', () => {
      const manager = new ConfigManager();
      const sources = [
        { mcp: { port: 3000 } },
        { mcp: { autoStart: true } }
      ];
      const merged = manager['mergeConfigs'](sources);
      expect(merged.mcp.port).toBe(3000);
      expect(merged.mcp.autoStart).toBe(true);
    });
  });
});
````

**Test Coverage**:

- ✅ Valid port range (1024-65535)
- ✅ Invalid ports (< 1024, > 65535)
- ✅ Type validation (number, boolean)
- ✅ Default values
- ✅ Config merging

---

### Definition of Done

- [ ] Config interface updated with MCP section
- [ ] Validation schema includes port range check (1024-65535)
- [ ] Defaults provide sensible values (port: 3000, autoStart: false)
- [ ] Config manager merges MCP section correctly
- [ ] Example config.json includes MCP section
- [ ] 5-8 unit tests pass
- [ ] Documentation updated
- [ ] No breaking changes to existing config
- [ ] Pre-commit hooks pass

---

## Issue #171: XDG User Config Paths

### **Priority**: P1 (Foundation)

### **Estimated Effort**: 2-4 hours

### **Risk Level**: Low-Medium

### Acceptance Criteria

- ✅ **AC-171-1**: Config discovery checks XDG_CONFIG_HOME
- ✅ **AC-171-2**: Fallback to ~/.config when XDG_CONFIG_HOME unset
- ✅ **AC-171-3**: Priority: CLI > env > project > user > defaults
- ✅ **AC-171-4**: User config path: `$XDG_CONFIG_HOME/ast-copilot-helper/config.json`
- ✅ **AC-171-5**: `--user-config` flag overrides default user config path
- ✅ **AC-171-6**: 8-12 unit tests for XDG resolution

### Files to Modify

#### 1. **packages/ast-helper/src/config/xdg-paths.ts** (CREATE NEW)

**Purpose**: Centralize XDG Base Directory Specification logic

```typescript
/**
 * XDG Base Directory Specification implementation
 * Handles user configuration path discovery
 */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Get XDG config home directory
 * Follows XDG Base Directory Specification:
 * - Returns $XDG_CONFIG_HOME if set
 * - Falls back to ~/.config if not set
 */
export function getXdgConfigHome(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  if (xdgConfigHome && xdgConfigHome.trim() !== "") {
    return xdgConfigHome;
  }

  return join(homedir(), ".config");
}

/**
 * Get user config directory for ast-copilot-helper
 * Returns: $XDG_CONFIG_HOME/ast-copilot-helper (or ~/.config/ast-copilot-helper)
 */
export function getUserConfigDir(): string {
  return join(getXdgConfigHome(), "ast-copilot-helper");
}

/**
 * Get user config file path
 * Returns: $XDG_CONFIG_HOME/ast-copilot-helper/config.json
 */
export function getUserConfigPath(): string {
  return join(getUserConfigDir(), "config.json");
}

/**
 * Resolve config file paths in priority order
 *
 * Priority:
 * 1. Custom user config (if --user-config flag provided)
 * 2. Project config (.astdb/config.json in workspace)
 * 3. User config (XDG or ~/.config)
 *
 * @param workspacePath - Workspace root directory
 * @param customUserConfig - Optional custom user config path from --user-config flag
 * @returns Array of config paths in priority order (highest priority last)
 */
export function resolveConfigPathsWithXdg(
  workspacePath: string,
  customUserConfig?: string,
): string[] {
  const paths: string[] = [];

  // 3. User config (lowest priority for file configs)
  if (customUserConfig) {
    // Custom user config from --user-config flag
    paths.push(customUserConfig);
  } else {
    // Default XDG user config
    paths.push(getUserConfigPath());
  }

  // 2. Project config (higher priority than user config)
  paths.push(join(workspacePath, ".astdb", "config.json"));

  return paths;
}
```

**Key Features**:

- XDG_CONFIG_HOME support with ~/.config fallback
- Follows XDG Base Directory Specification
- Handles custom user config path override
- Clear priority order documentation

**Testing**: Comprehensive unit tests for all functions  
**Breaking Changes**: None - new module

---

#### 2. **packages/ast-helper/src/config/files.ts**

**Current State**:

- Lines 43-53: `resolveConfigPaths()` returns hardcoded paths
- Uses `homedir()` directly without XDG support

**Changes Required**:

```typescript
// At top, add import
import { resolveConfigPathsWithXdg } from "./xdg-paths.js";

// Replace resolveConfigPaths() function (lines 43-53)
/**
 * Resolve configuration file paths in priority order
 * Supports XDG Base Directory Specification
 *
 * @param workspacePath - Workspace root directory
 * @param customUserConfig - Optional custom user config from --user-config flag
 * @returns Array of config file paths in priority order
 */
export function resolveConfigPaths(
  workspacePath: string,
  customUserConfig?: string,
): string[] {
  return resolveConfigPathsWithXdg(workspacePath, customUserConfig);
}
```

**Rationale**:

- Delegates to xdg-paths.ts for clean separation of concerns
- Maintains backward compatibility (same function signature when customUserConfig omitted)
- Enables --user-config flag support

**Testing**: Update existing tests, add XDG-specific tests  
**Breaking Changes**: None - signature extended with optional param

---

#### 3. **packages/ast-helper/src/config/manager.ts**

**Current State**:

- Line 24: `loadConfig(workspacePath, cliArgs)` method
- Line 38: Calls `loadConfigFiles(workspacePath)`

**Changes Required**:

```typescript
// Update loadConfig() method signature (line 24)
async loadConfig(
  workspacePath: string,
  cliArgs: CliArgs = {},
  customUserConfigPath?: string, // NEW PARAMETER
): Promise<Config> {
  try {
    // ... existing code ...

    // 4. User config and 3. Project config
    const fileConfigs = await loadConfigFiles(
      workspacePath,
      customUserConfigPath, // PASS NEW PARAMETER
    );

    // ... rest of existing code ...
  }
}
```

**Also Update loadConfigFiles() calls**:

```typescript
// Update getConfigPaths() method (line 115)
getConfigPaths(workspacePath: string, customUserConfigPath?: string): string[] {
  return resolveConfigPaths(workspacePath, customUserConfigPath);
}
```

**Rationale**:

- Passes --user-config flag value through to file loading
- Maintains existing behavior when customUserConfigPath not provided
- Minimal changes to existing logic

**Testing**: Test with and without custom user config  
**Breaking Changes**: None - optional parameter

---

#### 4. **packages/ast-helper/src/config/files.ts** (loadConfigFiles)

**Current State**:

- Line 57: `loadConfigFiles(workspacePath)` function
- Line 58: Calls `resolveConfigPaths(workspacePath)`

**Changes Required**:

```typescript
// Update function signature (line 57)
export async function loadConfigFiles(
  workspacePath: string,
  customUserConfigPath?: string, // NEW PARAMETER
): Promise<PartialConfig[]> {
  const configPaths = resolveConfigPaths(workspacePath, customUserConfigPath);
  const configs: PartialConfig[] = [];

  for (const configPath of configPaths) {
    const config = await loadConfigFile(configPath);
    if (Object.keys(config).length > 0) {
      configs.push(config);
    }
  }

  return configs;
}
```

**Rationale**: Passes custom user config path to resolution logic  
**Testing**: Test with custom path  
**Breaking Changes**: None - optional parameter

---

#### 5. **packages/ast-helper/src/types.ts** (CliArgs)

**Current State**:

- Lines 171-198: `CliArgs` interface

**Changes Required**:

```typescript
// Add to CliArgs interface (around line 195, before help/version)
"user-config"?: string; // Custom user config path
userConfig?: string;    // Camel case alias
```

**Rationale**:

- Supports --user-config flag
- Follows existing CLI arg naming convention (kebab-case + camelCase alias)

**Testing**: Test CLI arg parsing  
**Breaking Changes**: None - new optional field

---

#### 6. **packages/ast-helper/src/config/cli.ts**

**Current State**: Parses CLI arguments into PartialConfig

**Changes Required**:

```typescript
// Add to parseCliArgs() function
export function parseCliArgs(args: CliArgs): PartialConfig {
  const config: PartialConfig = {};

  // ... existing arg parsing ...

  // Note: --user-config is NOT added to config
  // It's passed separately to ConfigManager.loadConfig()
  // No changes needed here - just document the behavior

  return config;
}
```

**Rationale**:

- --user-config flag is NOT a config value
- It controls WHERE user config is loaded FROM
- Passed directly to ConfigManager, not merged into config

**Testing**: No changes needed  
**Breaking Changes**: None

---

#### 7. **packages/ast-helper/src/cli.ts** (Main CLI)

**Current State**:

- Lines 264-890: Command definitions
- Each command calls `ConfigManager.loadConfig()`

**Changes Required**:

```typescript
// In each command handler where ConfigManager is used:

// Example: init command (line ~275)
const configManager = new ConfigManager();
const config = await configManager.loadConfig(
  workspacePath,
  argv,
  argv.userConfig || argv["user-config"], // NEW: Pass custom user config
);

// Repeat for other commands: parse, embed, query, watch, etc.
```

**Locations to Update**:

- Line ~275: `init` command
- Line ~310: `parse` command
- Line ~410: `annotate` command
- Line ~480: `embed` command
- Line ~525: `query` command
- Line ~565: `watch` command

**Rationale**: Enables --user-config flag across all commands  
**Testing**: Test flag with each command  
**Breaking Changes**: None - optional flag

---

#### 8. **packages/ast-helper/src/cli.ts** (Add global option)

**Current State**:

- Lines 150-240: Global yargs options (verbose, debug, etc.)

**Changes Required**:

```typescript
// Add after other global options (around line 230)
.option("user-config", {
  type: "string",
  description: "Custom user config file path",
  group: "Configuration:",
})
```

**Rationale**: Makes --user-config available to all commands  
**Testing**: Test flag parsing  
**Breaking Changes**: None - new option

---

#### 9. **README.md** - User Configuration Documentation

**Changes Required**: Add XDG configuration section

````markdown
### User Configuration

AST Copilot Helper supports user-level configuration following the XDG Base Directory Specification.

**Default User Config Path**:

- `$XDG_CONFIG_HOME/ast-copilot-helper/config.json` (if XDG_CONFIG_HOME is set)
- `~/.config/ast-copilot-helper/config.json` (fallback)

**Custom User Config Path**:

```bash
ast-helper --user-config=/path/to/config.json <command>
```
````

**Configuration Priority** (highest to lowest):

1. CLI arguments
2. Environment variables
3. Project config (`.astdb/config.json`)
4. User config (XDG or custom path)
5. Built-in defaults

**Example User Config** (`~/.config/ast-copilot-helper/config.json`):

```json
{
  "topK": 15,
  "snippetLines": 7,
  "enableTelemetry": false,
  "mcp": {
    "port": 3000,
    "autoStart": false
  }
}
```

````

**Location**: Add to "Configuration" section of README
**Testing**: None - documentation only
**Breaking Changes**: None

---

### Testing Requirements

#### Unit Tests (8-12 tests)

**File**: `packages/ast-helper/src/config/__tests__/xdg-paths.test.ts` (NEW)

```typescript
describe('XDG Path Resolution', () => {
  describe('getXdgConfigHome', () => {
    test('returns XDG_CONFIG_HOME when set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      expect(getXdgConfigHome()).toBe('/custom/config');
      delete process.env.XDG_CONFIG_HOME;
    });

    test('falls back to ~/.config when XDG_CONFIG_HOME not set', () => {
      delete process.env.XDG_CONFIG_HOME;
      expect(getXdgConfigHome()).toBe(join(homedir(), '.config'));
    });

    test('ignores empty XDG_CONFIG_HOME', () => {
      process.env.XDG_CONFIG_HOME = '   ';
      expect(getXdgConfigHome()).toBe(join(homedir(), '.config'));
      delete process.env.XDG_CONFIG_HOME;
    });
  });

  describe('getUserConfigDir', () => {
    test('returns correct user config directory', () => {
      expect(getUserConfigDir()).toBe(
        join(getXdgConfigHome(), 'ast-copilot-helper')
      );
    });
  });

  describe('getUserConfigPath', () => {
    test('returns correct user config file path', () => {
      expect(getUserConfigPath()).toBe(
        join(getUserConfigDir(), 'config.json')
      );
    });
  });

  describe('resolveConfigPathsWithXdg', () => {
    test('returns paths in correct priority order without custom config', () => {
      const paths = resolveConfigPathsWithXdg('/workspace');
      expect(paths).toEqual([
        getUserConfigPath(),
        '/workspace/.astdb/config.json',
      ]);
    });

    test('uses custom user config when provided', () => {
      const paths = resolveConfigPathsWithXdg('/workspace', '/custom/config.json');
      expect(paths).toEqual([
        '/custom/config.json',
        '/workspace/.astdb/config.json',
      ]);
    });

    test('project config has higher priority than user config', () => {
      const paths = resolveConfigPathsWithXdg('/workspace');
      const userConfigIndex = paths.indexOf(getUserConfigPath());
      const projectConfigIndex = paths.indexOf('/workspace/.astdb/config.json');
      expect(projectConfigIndex).toBeGreaterThan(userConfigIndex);
    });
  });
});
````

**Integration Tests (2-3 tests)**:

**File**: `packages/ast-helper/src/config/__tests__/config-integration.test.ts`

```typescript
describe("Configuration Integration with XDG", () => {
  test("loads user config from XDG_CONFIG_HOME", async () => {
    // Create temporary config in XDG location
    const tempXdgHome = await createTempDir();
    process.env.XDG_CONFIG_HOME = tempXdgHome;

    const userConfigPath = join(
      tempXdgHome,
      "ast-copilot-helper",
      "config.json",
    );
    await fs.mkdir(dirname(userConfigPath), { recursive: true });
    await fs.writeFile(userConfigPath, JSON.stringify({ topK: 25 }));

    const manager = new ConfigManager();
    const config = await manager.loadConfig("/workspace");

    expect(config.topK).toBe(25);

    // Cleanup
    delete process.env.XDG_CONFIG_HOME;
    await fs.rm(tempXdgHome, { recursive: true });
  });

  test("custom user config via --user-config flag overrides default", async () => {
    const customConfigPath = await createTempConfigFile({ snippetLines: 10 });

    const manager = new ConfigManager();
    const config = await manager.loadConfig("/workspace", {}, customConfigPath);

    expect(config.snippetLines).toBe(10);

    // Cleanup
    await fs.unlink(customConfigPath);
  });

  test("config priority: project overrides user config", async () => {
    // Setup user config
    const tempXdgHome = await createTempDir();
    process.env.XDG_CONFIG_HOME = tempXdgHome;
    const userConfigPath = join(
      tempXdgHome,
      "ast-copilot-helper",
      "config.json",
    );
    await fs.mkdir(dirname(userConfigPath), { recursive: true });
    await fs.writeFile(userConfigPath, JSON.stringify({ topK: 15 }));

    // Setup project config
    const workspacePath = await createTempDir();
    const projectConfigPath = join(workspacePath, ".astdb", "config.json");
    await fs.mkdir(dirname(projectConfigPath), { recursive: true });
    await fs.writeFile(projectConfigPath, JSON.stringify({ topK: 30 }));

    const manager = new ConfigManager();
    const config = await manager.loadConfig(workspacePath);

    // Project config should win
    expect(config.topK).toBe(30);

    // Cleanup
    delete process.env.XDG_CONFIG_HOME;
    await fs.rm(tempXdgHome, { recursive: true });
    await fs.rm(workspacePath, { recursive: true });
  });
});
```

---

### Definition of Done

- [ ] xdg-paths.ts module created with XDG resolution logic
- [ ] Config discovery checks XDG_CONFIG_HOME (with ~/.config fallback)
- [ ] --user-config flag added to CLI
- [ ] ConfigManager accepts custom user config path
- [ ] Priority order maintained: CLI > env > project > user > defaults
- [ ] 8-12 unit tests pass
- [ ] 2-3 integration tests pass
- [ ] Documentation updated (README, config docs)
- [ ] No breaking changes to existing config system
- [ ] Pre-commit and pre-push hooks pass

---

## Issue #169: HNSW Corruption Detection

### **Priority**: P2 (Enhancement)

### **Estimated Effort**: 6-8 hours

### **Risk Level**: Medium

### Acceptance Criteria

- ✅ **AC-169-1**: Compute SHA-256 checksum on index build
- ✅ **AC-169-2**: Store checksum alongside index file
- ✅ **AC-169-3**: Verify checksum on index load
- ✅ **AC-169-4**: Prompt user on corruption detected
- ✅ **AC-169-5**: Automatic index rebuild on user confirmation
- ✅ **AC-169-6**: `--rebuild-index` CLI command forces rebuild
- ✅ **AC-169-7**: 10-15 unit tests + 2-3 integration tests

### Files to Modify

#### 1. **packages/ast-helper/src/database/vector/corruption-detector.ts** (CREATE NEW)

**Purpose**: Centralize corruption detection logic

```typescript
/**
 * HNSW Index Corruption Detection
 * Implements checksum-based integrity verification
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

/**
 * Checksum metadata for index verification
 */
export interface IndexChecksum {
  /** SHA-256 checksum of index file */
  checksum: string;
  /** Timestamp when checksum was computed */
  timestamp: string;
  /** Index file size in bytes */
  fileSize: number;
  /** Index build time in milliseconds */
  buildTime: number;
  /** Number of vectors in index */
  vectorCount: number;
}

/**
 * Corruption detection result
 */
export interface CorruptionCheckResult {
  /** Whether index is valid */
  isValid: boolean;
  /** Error message if corrupted */
  error?: string;
  /** Stored checksum metadata */
  storedChecksum?: IndexChecksum;
  /** Computed checksum from current file */
  computedChecksum?: string;
}

/**
 * Compute SHA-256 checksum of a file
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  try {
    const data = await readFile(filePath);
    const hash = createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
  } catch (error) {
    throw new Error(
      `Failed to compute checksum for ${filePath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Get checksum file path for an index file
 */
export function getChecksumPath(indexPath: string): string {
  return `${indexPath}.checksum`;
}

/**
 * Store index checksum metadata
 */
export async function storeChecksum(
  indexPath: string,
  vectorCount: number,
  buildTime: number,
): Promise<void> {
  try {
    const checksum = await computeFileChecksum(indexPath);
    const stats = await readFile(indexPath).then((buf) => buf.length);

    const metadata: IndexChecksum = {
      checksum,
      timestamp: new Date().toISOString(),
      fileSize: stats,
      buildTime,
      vectorCount,
    };

    const checksumPath = getChecksumPath(indexPath);
    await mkdir(dirname(checksumPath), { recursive: true });
    await writeFile(checksumPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    throw new Error(`Failed to store checksum: ${(error as Error).message}`);
  }
}

/**
 * Load stored checksum metadata
 */
export async function loadChecksum(
  indexPath: string,
): Promise<IndexChecksum | null> {
  try {
    const checksumPath = getChecksumPath(indexPath);
    const data = await readFile(checksumPath, "utf-8");
    return JSON.parse(data) as IndexChecksum;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // Checksum file doesn't exist
    }
    throw new Error(`Failed to load checksum: ${(error as Error).message}`);
  }
}

/**
 * Verify index integrity against stored checksum
 */
export async function verifyIndexIntegrity(
  indexPath: string,
): Promise<CorruptionCheckResult> {
  try {
    // Load stored checksum
    const storedChecksum = await loadChecksum(indexPath);

    if (!storedChecksum) {
      return {
        isValid: false,
        error: "No checksum file found (index may be from older version)",
      };
    }

    // Compute current checksum
    const computedChecksum = await computeFileChecksum(indexPath);

    // Verify match
    if (computedChecksum !== storedChecksum.checksum) {
      return {
        isValid: false,
        error: "Index corruption detected: checksum mismatch",
        storedChecksum,
        computedChecksum,
      };
    }

    return {
      isValid: true,
      storedChecksum,
      computedChecksum,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Verification failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Prompt user for index rebuild (CLI only)
 * Returns true if user confirms rebuild
 */
export async function promptRebuild(): Promise<boolean> {
  // Use readline for interactive prompt
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      "Index corruption detected. Rebuild index now? (y/n): ",
    );
    return answer.toLowerCase().trim() === "y";
  } finally {
    rl.close();
  }
}
```

**Key Features**:

- SHA-256 checksum computation
- Checksum metadata storage (timestamp, file size, build time, vector count)
- Integrity verification on load
- Interactive rebuild prompt
- Comprehensive error handling

**Testing**: Extensive unit tests  
**Breaking Changes**: None - new module

---

#### 2. **packages/ast-helper/src/database/vector/hnsw-database.ts**

**Current State**:

- Lines 459-497: `rebuild()` method exists
- Lines 30-40: Constructor initializes index
- No corruption detection on load

**Changes Required**:

```typescript
// At top, add import
import {
  verifyIndexIntegrity,
  storeChecksum,
  promptRebuild,
  type CorruptionCheckResult,
} from './corruption-detector.js';

// Add private field to store build metrics
private lastBuildTime: number = 0;
private lastBuildTimestamp: Date | null = null;

// Update initialize() method (around line 50-90)
async initialize(): Promise<void> {
  if (this.initialized) {
    return;
  }

  try {
    // Initialize storage
    await this.storage.init();

    // Check if index already exists
    const indexExists = await this.storage.hasIndex();

    if (indexExists) {
      // VERIFY INTEGRITY BEFORE LOADING
      const indexPath = join(this.config.outputDir, 'hnsw.index');
      const verificationResult = await verifyIndexIntegrity(indexPath);

      if (!verificationResult.isValid) {
        console.warn('⚠️  Index corruption detected');
        console.warn(`   Reason: ${verificationResult.error}`);

        // Prompt for rebuild (only in CLI context)
        if (process.stdin.isTTY) {
          const shouldRebuild = await promptRebuild();
          if (shouldRebuild) {
            console.log('🔄 Rebuilding index...');
            await this.rebuild();
            console.log('✅ Index rebuilt successfully');
          } else {
            console.log('⏭️  Skipping rebuild (index may be unusable)');
          }
        } else {
          console.warn('   Run `ast-helper --rebuild-index` to fix');
        }
      } else {
        // Load existing index
        await this.rebuildIndexFromStorage();
        console.log('✅ Index loaded and verified');
      }
    } else {
      // Create new index
      await this.createNewIndex();
    }

    this.initialized = true;
  } catch (error) {
    throw new Error(`Failed to initialize database: ${(error as Error).message}`);
  }
}

// Update rebuild() method to compute and store checksum
async rebuild(): Promise<void> {
  this.ensureInitialized();

  const startTime = Date.now();

  try {
    // Notify external systems (e.g., MCP server cache) before rebuild
    if (this.config.onIndexRebuild) {
      await this.config.onIndexRebuild();
    }

    // Get all stored vectors
    const allNodeIds = await this.storage.getAllNodeIds();

    // Create a new HNSW index
    if (this.index) {
      this.index = null; // Release old index
    }

    this.index = new HierarchicalNSW("cosine", this.config.dimensions);
    await this.index.initIndex(
      this.config.maxElements,
      this.config.M,
      this.config.efConstruction,
    );

    // Re-add all vectors to the index
    for (const nodeId of allNodeIds) {
      const stored = await this.storage.getVector(nodeId);
      if (stored) {
        const label = await this.storage.getLabelMapping(nodeId);
        if (label !== null) {
          this.index.addPoint(stored.vector, label);
        }
      }
    }

    // Save rebuilt index
    await this.storage.saveIndex(this.index);

    // COMPUTE AND STORE CHECKSUM
    const buildTime = Date.now() - startTime;
    this.lastBuildTime = buildTime;
    this.lastBuildTimestamp = new Date();

    const indexPath = join(this.config.outputDir, 'hnsw.index');
    await storeChecksum(indexPath, allNodeIds.length, buildTime);

    console.log(`✅ Rebuilt HNSW index with ${allNodeIds.length} vectors in ${buildTime}ms`);
  } catch (error) {
    throw new Error(`Failed to rebuild index: ${(error as Error).message}`);
  }
}

// Add method to get build metrics
getBuildMetrics(): { buildTime: number; timestamp: Date | null } {
  return {
    buildTime: this.lastBuildTime,
    timestamp: this.lastBuildTimestamp,
  };
}
```

**Key Changes**:

1. Import corruption detection utilities
2. Verify integrity on index load in `initialize()`
3. Prompt for rebuild if corruption detected
4. Store checksum after successful rebuild
5. Track build metrics (time, timestamp)

**Testing**: Integration tests for corruption scenarios  
**Breaking Changes**: None - graceful handling of missing checksums

---

#### 3. **packages/ast-helper/src/cli.ts** - Add `--rebuild-index` command

**Current State**:

- Lines 519-557: `query` command
- No rebuild command

**Changes Required**:

```typescript
// Add new command after query command (around line 560)
.command("rebuild-index")
.description("Force rebuild of HNSW vector index")
.option("config", {
  type: "string",
  description: "Path to configuration file",
})
.option("output-dir", {
  type: "string",
  description: "Database output directory",
  default: ".astdb",
})
.handler(async (argv) => {
  console.log("🔄 Rebuilding HNSW vector index...");

  try {
    // Load configuration
    const configManager = new ConfigManager();
    const workspacePath = process.cwd();
    const config = await configManager.loadConfig(
      workspacePath,
      argv as any,
      argv.userConfig || argv['user-config'],
    );

    // Initialize database
    const db = new HNSWDatabase({
      outputDir: argv.outputDir || config.outputDir,
      dimensions: 768, // CodeBERT embedding size
      maxElements: 100000,
      M: config.indexParams.M,
      efConstruction: config.indexParams.efConstruction,
      efSearch: 200,
    });

    await db.initialize();

    // Force rebuild
    await db.rebuild();

    console.log("✅ Index rebuild complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Rebuild failed:", (error as Error).message);
    process.exit(1);
  }
})
```

**Rationale**:

- Provides manual rebuild command for corrupted indexes
- Useful for non-interactive environments
- Forces rebuild without prompts

**Testing**: Test command execution  
**Breaking Changes**: None - new command

---

#### 4. **packages/ast-helper/src/database/vector/hnsw-database.ts** - Add force flag

**Changes Required**:

```typescript
// Update rebuild() signature to accept force flag
async rebuild(force: boolean = false): Promise<void> {
  this.ensureInitialized();

  // Skip prompt check if force=true
  if (!force && process.stdin.isTTY) {
    // Existing prompt logic
  }

  // ... rest of rebuild implementation ...
}

// Update --rebuild-index command handler to pass force=true
await db.rebuild(true); // Force rebuild without prompts
```

**Rationale**: Enables scripted/automated rebuilds  
**Testing**: Test force flag  
**Breaking Changes**: None - optional parameter

---

### Testing Requirements

#### Unit Tests (10-15 tests)

**File**: `packages/ast-helper/src/database/vector/__tests__/corruption-detector.test.ts` (NEW)

```typescript
describe("Corruption Detection", () => {
  describe("computeFileChecksum", () => {
    test("computes valid SHA-256 checksum", async () => {
      const tempFile = await createTempFile("test data");
      const checksum = await computeFileChecksum(tempFile);
      expect(checksum).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
      await fs.unlink(tempFile);
    });

    test("throws error for non-existent file", async () => {
      await expect(
        computeFileChecksum("/nonexistent/file.bin"),
      ).rejects.toThrow();
    });

    test("produces consistent checksum for same content", async () => {
      const data = "consistent test data";
      const file1 = await createTempFile(data);
      const file2 = await createTempFile(data);

      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);

      expect(checksum1).toBe(checksum2);

      await fs.unlink(file1);
      await fs.unlink(file2);
    });

    test("produces different checksum for different content", async () => {
      const file1 = await createTempFile("data 1");
      const file2 = await createTempFile("data 2");

      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);

      expect(checksum1).not.toBe(checksum2);

      await fs.unlink(file1);
      await fs.unlink(file2);
    });
  });

  describe("storeChecksum", () => {
    test("stores checksum metadata correctly", async () => {
      const tempFile = await createTempFile("index data");
      await storeChecksum(tempFile, 100, 5000);

      const checksumPath = getChecksumPath(tempFile);
      const metadata = JSON.parse(await fs.readFile(checksumPath, "utf-8"));

      expect(metadata.checksum).toBeDefined();
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.buildTime).toBe(5000);
      expect(metadata.vectorCount).toBe(100);

      await fs.unlink(tempFile);
      await fs.unlink(checksumPath);
    });
  });

  describe("loadChecksum", () => {
    test("loads existing checksum metadata", async () => {
      const tempFile = await createTempFile("index data");
      await storeChecksum(tempFile, 50, 3000);

      const metadata = await loadChecksum(tempFile);

      expect(metadata).not.toBeNull();
      expect(metadata!.vectorCount).toBe(50);
      expect(metadata!.buildTime).toBe(3000);

      await fs.unlink(tempFile);
      await fs.unlink(getChecksumPath(tempFile));
    });

    test("returns null for missing checksum file", async () => {
      const metadata = await loadChecksum("/nonexistent/index.bin");
      expect(metadata).toBeNull();
    });
  });

  describe("verifyIndexIntegrity", () => {
    test("passes verification for valid index", async () => {
      const tempFile = await createTempFile("valid index data");
      await storeChecksum(tempFile, 10, 1000);

      const result = await verifyIndexIntegrity(tempFile);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.storedChecksum).toBeDefined();
      expect(result.computedChecksum).toBe(result.storedChecksum!.checksum);

      await fs.unlink(tempFile);
      await fs.unlink(getChecksumPath(tempFile));
    });

    test("detects corruption when index modified", async () => {
      const tempFile = await createTempFile("original data");
      await storeChecksum(tempFile, 10, 1000);

      // Corrupt the index
      await fs.writeFile(tempFile, "corrupted data");

      const result = await verifyIndexIntegrity(tempFile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("checksum mismatch");
      expect(result.computedChecksum).not.toBe(result.storedChecksum!.checksum);

      await fs.unlink(tempFile);
      await fs.unlink(getChecksumPath(tempFile));
    });

    test("handles missing checksum file gracefully", async () => {
      const tempFile = await createTempFile("index without checksum");

      const result = await verifyIndexIntegrity(tempFile);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No checksum file found");

      await fs.unlink(tempFile);
    });
  });
});
```

**Integration Tests (2-3 tests)**:

**File**: `packages/ast-helper/src/database/vector/__tests__/hnsw-corruption-integration.test.ts` (NEW)

```typescript
describe("HNSW Corruption Integration", () => {
  test("rebuilds corrupted index automatically on prompt confirmation", async () => {
    const tempDir = await createTempDir();
    const db = new HNSWDatabase({
      outputDir: tempDir,
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      efSearch: 100,
    });

    // Initialize and add vectors
    await db.initialize();
    const vector = new Array(768).fill(0.5);
    await db.addVector("node-1", vector, { text: "test" });

    // Save index
    await db.close();

    // Corrupt index file
    const indexPath = join(tempDir, "hnsw.index");
    await fs.appendFile(indexPath, "corruption");

    // Re-initialize (should detect corruption)
    const db2 = new HNSWDatabase({
      outputDir: tempDir,
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      efSearch: 100,
    });

    // Mock stdin for prompt confirmation
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;

    // Mock readline to auto-confirm rebuild
    jest
      .spyOn(require("node:readline/promises"), "createInterface")
      .mockReturnValue({
        question: jest.fn().mockResolvedValue("y"),
        close: jest.fn(),
      });

    await db2.initialize();

    // Verify index was rebuilt
    const result = await db2.query(vector, 1);
    expect(result.length).toBeGreaterThan(0);

    // Cleanup
    process.stdin.isTTY = originalIsTTY;
    await fs.rm(tempDir, { recursive: true });
  });

  test("--rebuild-index command rebuilds index", async () => {
    const tempDir = await createTempDir();
    const db = new HNSWDatabase({
      outputDir: tempDir,
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      efSearch: 100,
    });

    await db.initialize();
    const vector = new Array(768).fill(0.5);
    await db.addVector("node-1", vector, { text: "test" });

    // Rebuild via public method
    await db.rebuild(true); // Force rebuild

    // Verify checksum exists
    const indexPath = join(tempDir, "hnsw.index");
    const checksumPath = getChecksumPath(indexPath);
    const checksumExists = await fs
      .access(checksumPath)
      .then(() => true)
      .catch(() => false);

    expect(checksumExists).toBe(true);

    // Cleanup
    await fs.rm(tempDir, { recursive: true });
  });

  test("checksum stored after successful rebuild", async () => {
    const tempDir = await createTempDir();
    const db = new HNSWDatabase({
      outputDir: tempDir,
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      efSearch: 100,
    });

    await db.initialize();
    const vector = new Array(768).fill(0.5);
    await db.addVector("node-1", vector, { text: "test" });

    await db.rebuild();

    // Verify checksum file
    const indexPath = join(tempDir, "hnsw.index");
    const checksum = await loadChecksum(indexPath);

    expect(checksum).not.toBeNull();
    expect(checksum!.vectorCount).toBe(1);
    expect(checksum!.buildTime).toBeGreaterThan(0);

    // Cleanup
    await fs.rm(tempDir, { recursive: true });
  });
});
```

---

### Definition of Done

- [ ] corruption-detector.ts module created
- [ ] SHA-256 checksum computed on index build
- [ ] Checksum metadata stored (timestamp, size, build time, vector count)
- [ ] Checksum verified on index load
- [ ] Interactive prompt on corruption detected
- [ ] Automatic rebuild on user confirmation
- [ ] --rebuild-index CLI command implemented
- [ ] Force rebuild option (no prompts)
- [ ] 10-15 unit tests pass
- [ ] 2-3 integration tests pass
- [ ] Documentation updated (README, commands)
- [ ] Pre-commit and pre-push hooks pass

---

## Testing Strategy

### Test Pyramid

```
       /\
      /  \     E2E Tests (Manual)
     /    \    - Full workflow testing
    /------\   - Real config files
   /        \  - Real corruption scenarios
  /          \
 /   Integration Tests (2-3 per issue)
/    - Multi-module interaction
/    - Real file I/O
/    - Database operations
/----------------------------------------\
              Unit Tests (30-40 total)
              - Individual functions
              - Edge cases
              - Error handling
```

### Test Coverage Targets

- **Issue #170 (MCP Config)**: 5-8 unit tests
  - Config validation (port range, types)
  - Config merging
  - Defaults

- **Issue #171 (XDG Paths)**: 8-12 unit tests + 2-3 integration
  - XDG resolution logic
  - Custom user config
  - Priority order
  - File loading

- **Issue #169 (Corruption)**: 10-15 unit tests + 2-3 integration
  - Checksum computation
  - Integrity verification
  - Rebuild logic
  - Prompt handling

### Pre-Commit Testing

Run fast unit tests only:

```bash
yarn run test:precommit
```

### Pre-Push Testing

Run comprehensive tests:

```bash
yarn run test:prepush
```

### CI/CD Testing

All tests including benchmarks:

```bash
yarn run test:all
```

---

## Risk Mitigation

### Issue #170 Risks

| Risk                      | Likelihood | Impact | Mitigation                                 |
| ------------------------- | ---------- | ------ | ------------------------------------------ |
| Breaking existing configs | Low        | High   | Make section optional, validate gracefully |
| Invalid port conflicts    | Low        | Medium | Comprehensive validation (1024-65535)      |
| Merge conflicts           | Low        | Low    | Isolated changes, test thoroughly          |

### Issue #171 Risks

| Risk                   | Likelihood | Impact | Mitigation                            |
| ---------------------- | ---------- | ------ | ------------------------------------- |
| XDG env var edge cases | Medium     | Medium | Test empty, whitespace, invalid paths |
| Custom path security   | Low        | High   | Validate paths, document security     |
| Cross-platform issues  | Low        | Medium | Use Node.js path utilities            |

### Issue #169 Risks

| Risk                             | Likelihood | Impact   | Mitigation                             |
| -------------------------------- | ---------- | -------- | -------------------------------------- |
| Checksum computation performance | Medium     | Low      | Async computation, show progress       |
| False positive corruption        | Low        | High     | Robust verification, handle edge cases |
| Rebuild data loss                | Low        | Critical | Rebuild from storage, not memory       |
| Prompt in non-TTY context        | Medium     | Medium   | Detect TTY, provide CLI fallback       |

---

## Success Criteria

### Technical Success

- ✅ All 19 acceptance criteria met
- ✅ 30-40 unit tests passing
- ✅ 5-8 integration tests passing
- ✅ Pre-commit hooks passing
- ✅ Pre-push validation passing
- ✅ No breaking changes
- ✅ Documentation complete

### User Experience Success

- ✅ Clear error messages
- ✅ Helpful validation suggestions
- ✅ Sensible defaults
- ✅ Non-intrusive prompts
- ✅ Clear CLI commands

### Code Quality Success

- ✅ Type-safe implementations
- ✅ Comprehensive error handling
- ✅ Consistent code patterns
- ✅ Clear separation of concerns
- ✅ Maintainable test coverage

---

## Appendix: File Change Summary

### Files to Create (5)

1. `packages/ast-helper/src/config/xdg-paths.ts` - XDG path resolution
2. `packages/ast-helper/src/database/vector/corruption-detector.ts` - Corruption detection
3. `examples/config.json` - Example configuration
4. `packages/ast-helper/src/config/__tests__/xdg-paths.test.ts` - XDG tests
5. `packages/ast-helper/src/database/vector/__tests__/corruption-detector.test.ts` - Corruption tests

### Files to Modify (10)

1. `packages/ast-helper/src/types.ts` - Add MCP config, --user-config arg
2. `packages/ast-helper/src/config/defaults.ts` - Add MCP defaults
3. `packages/ast-helper/src/config/validation-schema.ts` - Add MCP validation
4. `packages/ast-helper/src/config/manager.ts` - Add custom user config support
5. `packages/ast-helper/src/config/files.ts` - Use XDG paths
6. `packages/ast-helper/src/database/vector/hnsw-database.ts` - Add corruption detection
7. `packages/ast-helper/src/cli.ts` - Add --user-config flag, --rebuild-index command
8. `README.md` - Document MCP config, XDG paths, rebuild command
9. `packages/ast-helper/src/config/__tests__/config-integration.test.ts` - XDG integration tests
10. `packages/ast-helper/src/database/vector/__tests__/hnsw-corruption-integration.test.ts` - Corruption integration tests

### Total Changes

- **New Files**: 5
- **Modified Files**: 10
- **Total Tests**: 30-40 unit, 5-8 integration
- **Documentation Updates**: README, config docs, API docs

---

**Plan Complete** ✅

This implementation plan provides a comprehensive, file-by-file guide for implementing all three issues in Sprint 3. Each section includes detailed code examples, testing requirements, and risk mitigation strategies.

**Next Steps**: Begin implementation with Issue #170 (MCP Config Schema).
