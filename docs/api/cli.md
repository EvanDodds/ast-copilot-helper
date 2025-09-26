# CLI API Reference

The ast-copilot-helper CLI provides powerful commands for parsing source code and querying AST annotations.

## Global Options

All commands support these global options:

| Option            | Description              | Default            |
| ----------------- | ------------------------ | ------------------ |
| `--config <file>` | Configuration file path  | `.ast-copilot-helper.json` |
| `--verbose, -v`   | Enable verbose logging   | `false`            |
| `--silent, -s`    | Suppress output messages | `false`            |
| `--help, -h`      | Show help information    | -                  |
| `--version`       | Show version information | -                  |

## Commands

### `ast-copilot-helper parse`

Parse source code files and extract AST annotations.

#### Usage

```bash
ast-copilot-helper parse [options] <files...>
```

#### Options

| Option                   | Alias | Description                        | Default            |
| ------------------------ | ----- | ---------------------------------- | ------------------ |
| `--output <file>`        | `-o`  | Output file for parsed annotations | `annotations.json` |
| `--format <format>`      | `-f`  | Output format (json, yaml, xml)    | `json`             |
| `--include <patterns>`   | `-i`  | File patterns to include           | `**/*`             |
| `--exclude <patterns>`   | `-e`  | File patterns to exclude           | `node_modules/**`  |
| `--recursive`            | `-r`  | Parse directories recursively      | `true`             |
| `--watch`                | `-w`  | Watch files for changes            | `false`            |
| `--incremental`          |       | Enable incremental parsing         | `false`            |
| `--max-files <num>`      |       | Maximum files to process           | `1000`             |
| `--max-file-size <size>` |       | Maximum file size (MB)             | `10`               |

#### Examples

**Parse TypeScript files in src directory:**

```bash
ast-copilot-helper parse src/**/*.ts
```

**Parse with JSON output:**

```bash
ast-copilot-helper parse --output annotations.json --format json src/
```

**Watch for changes and reparse:**

```bash
ast-copilot-helper parse --watch --recursive src/
```

**Parse with exclusions:**

```bash
ast-copilot-helper parse --exclude "**/*.test.ts" --exclude "**/node_modules/**" src/
```

**Incremental parsing for large codebases:**

```bash
ast-copilot-helper parse --incremental --max-files 5000 src/
```

#### Output Format

The parse command outputs structured annotations in the specified format:

::: code-group

```json [JSON Output]
{
  "metadata": {
    "version": "1.0.0",
    "timestamp": "2024-01-15T10:30:00Z",
    "totalFiles": 42,
    "totalAnnotations": 156
  },
  "annotations": [
    {
      "id": "func_getUserById_123",
      "type": "function",
      "name": "getUserById",
      "file": "src/users.ts",
      "line": 15,
      "column": 0,
      "description": "Retrieves user by ID from database",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "description": "User identifier"
        }
      ],
      "returnType": "Promise<User>",
      "annotations": ["@auth", "@cache"],
      "embedding": [0.1, 0.5, -0.2, ...]
    }
  ]
}
```

```yaml [YAML Output]
metadata:
  version: "1.0.0"
  timestamp: "2024-01-15T10:30:00Z"
  totalFiles: 42
  totalAnnotations: 156
annotations:
  - id: "func_getUserById_123"
    type: "function"
    name: "getUserById"
    file: "src/users.ts"
    line: 15
    column: 0
    description: "Retrieves user by ID from database"
    parameters:
      - name: "id"
        type: "string"
        description: "User identifier"
    returnType: "Promise<User>"
    annotations: ["@auth", "@cache"]
    embedding: [0.1, 0.5, -0.2, ...]
```

:::

### `ast-copilot-helper query`

Query parsed annotations using natural language or structured queries.

#### Usage

```bash
ast-copilot-helper query [options] <query>
```

#### Options

| Option                     | Alias | Description                              | Default          |
| -------------------------- | ----- | ---------------------------------------- | ---------------- |
| `--database <file>`        | `-d`  | Database file with parsed annotations    | `.ast-copilot-helper.db` |
| `--limit <number>`         | `-l`  | Maximum number of results to return      | `10`             |
| `--similarity <threshold>` | `-s`  | Similarity threshold for semantic search | `0.7`            |
| `--format <format>`        | `-f`  | Output format for results                | `json`           |
| `--explain`                |       | Explain how the query was processed      | `false`          |
| `--type <type>`            | `-t`  | Filter by annotation type                | `all`            |
| `--file <pattern>`         |       | Filter by file pattern                   | `*`              |

#### Examples

**Find authentication functions:**

```bash
ast-copilot-helper query "functions that handle user authentication"
```

**Find error handling patterns:**

```bash
ast-copilot-helper query --limit 5 "error handling patterns"
```

**Find specific function type:**

```bash
ast-copilot-helper query --type function --file "src/**/*.ts" "database queries"
```

**Query with explanation:**

```bash
ast-copilot-helper query --explain "API endpoints for user management"
```

#### Query Types

The query command supports multiple query types:

1. **Natural Language**: `"functions that handle HTTP requests"`
2. **Semantic**: `"authentication logic"`
3. **Structural**: `type:function name:get*`
4. **Combined**: `"user management" AND type:class`

### `ast-copilot-helper analyze`

Analyze code patterns, quality metrics, and potential issues.

#### Usage

```bash
ast-copilot-helper analyze [options] <files...>
```

#### Options

| Option              | Alias | Description                       | Default  |
| ------------------- | ----- | --------------------------------- | -------- |
| `--output <file>`   | `-o`  | Output file for analysis results  | `stdout` |
| `--format <format>` | `-f`  | Output format (json, yaml, table) | `table`  |
| `--metrics`         | `-m`  | Include code metrics              | `true`   |
| `--security`        | `-s`  | Run security analysis             | `false`  |
| `--performance`     | `-p`  | Check performance patterns        | `false`  |
| `--complexity`      | `-c`  | Calculate complexity metrics      | `true`   |
| `--threshold <num>` | `-t`  | Complexity threshold for warnings | `10`     |

#### Examples

**Analyze code quality:**

```bash
ast-copilot-helper analyze src/ --metrics --complexity
```

**Security analysis:**

```bash
ast-copilot-helper analyze src/ --security --format json
```

**Performance analysis:**

```bash
ast-copilot-helper analyze src/ --performance --threshold 5
```

### `ast-copilot-helper init`

Initialize ast-copilot-helper configuration in the current directory.

#### Usage

```bash
ast-copilot-helper init [options]
```

#### Options

| Option                  | Description                      | Default   |
| ----------------------- | -------------------------------- | --------- |
| `--template <template>` | Use configuration template       | `default` |
| `--force`               | Overwrite existing configuration | `false`   |
| `--interactive`         | Interactive configuration setup  | `true`    |

#### Templates

Available configuration templates:

- `default`: Basic configuration for most projects
- `typescript`: TypeScript-specific configuration
- `javascript`: JavaScript-specific configuration
- `python`: Python project configuration
- `monorepo`: Multi-package repository configuration

#### Examples

**Initialize with default template:**

```bash
ast-copilot-helper init
```

**Initialize with TypeScript template:**

```bash
ast-copilot-helper init --template typescript
```

**Force overwrite existing config:**

```bash
ast-copilot-helper init --force --template monorepo
```

### `ast-copilot-helper server`

Start the MCP (Model Context Protocol) server for AI agent integration.

#### Usage

```bash
ast-copilot-helper server [options]
```

#### Options

| Option               | Description                            | Default          |
| -------------------- | -------------------------------------- | ---------------- |
| `--port <port>`      | Server port                            | `3001`           |
| `--host <host>`      | Server host                            | `localhost`      |
| `--transport <type>` | Transport type (stdio, sse, websocket) | `stdio`          |
| `--database <file>`  | Database file path                     | `.ast-copilot-helper.db` |
| `--cors`             | Enable CORS for web clients            | `false`          |
| `--auth <token>`     | Authentication token                   | `none`           |

#### Examples

**Start server with stdio transport:**

```bash
ast-copilot-helper server --transport stdio
```

**Start HTTP server with CORS:**

```bash
ast-copilot-helper server --transport sse --port 3001 --cors
```

**Start WebSocket server:**

```bash
ast-copilot-helper server --transport websocket --host 0.0.0.0 --port 8080
```

### `ast-copilot-helper config`

Manage configuration settings.

#### Usage

```bash
ast-copilot-helper config <command> [options]
```

#### Subcommands

| Command             | Description             |
| ------------------- | ----------------------- |
| `set <key> <value>` | Set configuration value |
| `get <key>`         | Get configuration value |
| `list`              | List all configuration  |
| `validate`          | Validate configuration  |
| `reset`             | Reset to defaults       |

#### Examples

**Set configuration value:**

```bash
ast-copilot-helper config set parser.maxFileSize 20
```

**Get configuration value:**

```bash
ast-copilot-helper config get parser.includePatterns
```

**List all configuration:**

```bash
ast-copilot-helper config list
```

### `ast-copilot-helper diagnose`

Generate diagnostic information for troubleshooting.

#### Usage

```bash
ast-copilot-helper diagnose [options]
```

#### Options

| Option              | Description                   | Default  |
| ------------------- | ----------------------------- | -------- |
| `--output <file>`   | Output diagnostic report      | `stdout` |
| `--format <format>` | Output format                 | `json`   |
| `--include-env`     | Include environment variables | `false`  |
| `--include-logs`    | Include recent log entries    | `true`   |

#### Examples

**Generate diagnostic report:**

```bash
ast-copilot-helper diagnose --output diagnostic.json
```

**Full diagnostic with environment:**

```bash
ast-copilot-helper diagnose --include-env --include-logs
```

## Exit Codes

The CLI uses the following exit codes:

| Code | Description       |
| ---- | ----------------- |
| `0`  | Success           |
| `1`  | General error     |
| `2`  | Invalid arguments |
| `3`  | File not found    |
| `4`  | Permission denied |
| `5`  | Database error    |
| `6`  | Parse error       |
| `7`  | Network error     |

## Configuration File

The CLI reads configuration from `.ast-copilot-helper.json`:

```json
{
  "parser": {
    "includePatterns": ["**/*.{ts,js,py}"],
    "excludePatterns": ["node_modules/**", "dist/**"],
    "maxFileSize": 10,
    "maxFiles": 1000,
    "languages": ["typescript", "javascript", "python"]
  },
  "database": {
    "path": ".ast-copilot-helper.db",
    "cacheSize": 100,
    "enableWAL": true
  },
  "server": {
    "port": 3001,
    "host": "localhost",
    "cors": false,
    "rateLimit": 100
  },
  "ai": {
    "embeddingModel": "text-embedding-3-small",
    "embeddingDimensions": 1536,
    "similarityThreshold": 0.7
  }
}
```

## Environment Variables

| Variable               | Description                          | Default             |
| ---------------------- | ------------------------------------ | ------------------- |
| `AST_HELPER_CONFIG`    | Configuration file path              | `.ast-copilot-helper.json`  |
| `AST_HELPER_DB`        | Database file path                   | `.ast-copilot-helper.db`    |
| `AST_HELPER_LOG_LEVEL` | Log level (debug, info, warn, error) | `info`              |
| `AST_HELPER_CACHE_DIR` | Cache directory                      | `.ast-copilot-helper/cache` |
