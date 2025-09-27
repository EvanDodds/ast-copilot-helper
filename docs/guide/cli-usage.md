# CLI Usage Guide

Master the AST Copilot Helper command-line interface with this comprehensive guide covering all commands, options, and usage patterns.

## Overview

The `ast-copilot-helper` CLI provides powerful tools for parsing, querying, and managing semantic code analysis across 15+ programming languages. This guide covers everything from basic usage to advanced techniques.

## Global Options

These options work with all commands:

| Option            | Description                | Default                    |
| ----------------- | -------------------------- | -------------------------- |
| `--config <file>` | Path to configuration file | `.ast-copilot-helper.json` |
| `--verbose, -v`   | Enable verbose logging     | `false`                    |
| `--quiet, -q`     | Suppress non-error output  | `false`                    |
| `--debug, -d`     | Enable debug mode          | `false`                    |
| `--help, -h`      | Show help for command      | -                          |
| `--version`       | Show version information   | -                          |

## Core Commands

### `ast-copilot-helper init`

Initialize AST Copilot Helper in your project.

```bash
# Initialize with interactive prompts
ast-copilot-helper init

# Initialize with specific language focus
ast-copilot-helper init --language typescript

# Initialize for monorepo structure
ast-copilot-helper init --workspace-root ./packages

# Skip interactive prompts (use defaults)
ast-copilot-helper init --yes
```

#### Options

| Option                   | Description                                         | Default           |
| ------------------------ | --------------------------------------------------- | ----------------- |
| `--language, -l <lang>`  | Primary language focus (auto-detects all supported) | Auto-detect       |
| `--workspace-root <dir>` | Root directory for analysis                         | Current directory |
| `--include <patterns>`   | File patterns to include                            | Language defaults |
| `--exclude <patterns>`   | File patterns to exclude                            | `node_modules/**` |
| `--yes, -y`              | Skip interactive prompts                            | `false`           |

#### Examples

```bash
# TypeScript project with specific patterns
ast-copilot-helper init -l typescript --include "src/**/*.ts" --exclude "**/*.test.ts"

# Python project with custom workspace
ast-copilot-helper init -l python --workspace-root ./my-python-app

# Quick setup with defaults
ast-copilot-helper init -y
```

### `ast-copilot-helper parse`

Parse and analyze code to extract semantic annotations and generate embeddings.

```bash
# Parse current directory
ast-copilot-helper parse

# Parse all files in src directory
ast-copilot-helper parse src/

# Parse specific files
ast-copilot-helper parse file1.ts file2.js

# Parse with custom patterns
ast-copilot-helper parse "**/*.{ts,js,py,rs}" --exclude "**/*.test.*"

# Parse and show progress
ast-copilot-helper parse src/ --progress
```

#### Options

| Option                 | Description                  | Default                  |
| ---------------------- | ---------------------------- | ------------------------ |
| `--include <patterns>` | File patterns to include     | Config default           |
| `--exclude <patterns>` | File patterns to exclude     | Config default           |
| `--language <lang>`    | Force specific language      | Auto-detect              |
| `--output, -o <file>`  | Output database file         | `.ast-copilot-helper.db` |
| `--format <type>`      | Output format (db, json)     | `db`                     |
| `--progress`           | Show parsing progress        | `false`                  |
| `--parallel <num>`     | Max parallel processes       | CPU count                |
| `--force`              | Overwrite existing database  | `false`                  |
| `--embeddings`         | Generate semantic embeddings | `true`                   |

#### Examples

```bash
# Parse with progress and custom output
ast-copilot-helper parse src/ --progress --output analysis.db

# Parse only TypeScript files
ast-copilot-helper parse "**/*.ts" --language typescript

# Force reparse everything
ast-copilot-helper parse src/ --force

# Parse with limited parallelism
ast-copilot-helper parse src/ --parallel 2

# Export to JSON instead of database
ast-copilot-helper parse src/ --format json --output annotations.json

# Parse without generating embeddings (faster)
ast-copilot-helper parse src/ --no-embeddings
```

#### Output Formats

**Database Format (Default):**

```bash
ast-copilot-helper parse src/
# Creates .ast-copilot-helper.db SQLite database
```

**JSON Format:**

```bash
ast-copilot-helper parse src/ --format json --output annotations.json
# Creates annotations.json with all extracted data
```

### `ast-copilot-helper query`

Search your codebase using natural language semantic search or specific filters.

```bash
# Natural language search
ast-copilot-helper query "authentication functions"

# Search for specific types
ast-copilot-helper query "API endpoints" --type function

# Get detailed results
ast-copilot-helper query "error handling" --verbose

# Limit results and adjust similarity
ast-copilot-helper query "database operations" --limit 5 --threshold 0.8
```

#### Options

| Option              | Description                           | Default   |
| ------------------- | ------------------------------------- | --------- |
| `--type <type>`     | Filter by annotation type             | All types |
| `--file <pattern>`  | Filter by file pattern                | All files |
| `--limit, -l <num>` | Maximum results to return             | 10        |
| `--threshold <num>` | Similarity threshold (0-1)            | 0.7       |
| `--format <type>`   | Output format (table, json, detailed) | `table`   |
| `--sort <field>`    | Sort by field (score, name, file)     | `score`   |
| `--no-embeddings`   | Use text search instead of semantic   | `false`   |

#### Query Types

**Natural Language:**

```bash
ast-copilot-helper query "functions that handle user authentication"
ast-copilot-helper query "error handling and exception management"
ast-copilot-helper query "API endpoints for user data"
ast-copilot-helper query "utility functions for string manipulation"
```

**Type-Specific:**

```bash
ast-copilot-helper query "*" --type function      # All functions
ast-copilot-helper query "*" --type class         # All classes
ast-copilot-helper query "*" --type interface     # All interfaces
ast-copilot-helper query "*" --type variable      # All variables
```

**File-Specific:**

```bash
ast-copilot-helper query "database" --file "**/*model*"    # Only model files
ast-copilot-helper query "auth" --file "src/auth/**"       # Only auth directory
ast-copilot-helper query "test" --file "**/*.test.ts"      # Only test files
```

#### Output Formats

**Table Format (Default):**

```bash
ast-copilot-helper query "auth functions"
# ┌─────────────────┬──────────────────┬───────┬─────────┐
# │ Name            │ File             │ Line  │ Score   │
# ├─────────────────┼──────────────────┼───────┼─────────┤
# │ authenticateUser│ src/auth.ts      │ 23    │ 0.89    │
# │ validateToken   │ src/auth.ts      │ 45    │ 0.85    │
# └─────────────────┴──────────────────┴───────┴─────────┘
```

**JSON Format:**

```bash
ast-copilot-helper query "auth functions" --format json
# [
#   {
#     "id": "func_authenticateUser_123",
#     "name": "authenticateUser",
#     "type": "function",
#     "file": "src/auth.ts",
#     "line": 23,
#     "score": 0.89,
#     "description": "Authenticates user with credentials"
#   }
# ]
```

**Detailed Format:**

```bash
ast-copilot-helper query "auth functions" --format detailed
# 🔍 authenticateUser (src/auth.ts:23) [Score: 0.89]
#    Authenticates user with credentials
#    Parameters: username: string, password: string
#    Returns: Promise<AuthResult>
#
# 🔍 validateToken (src/auth.ts:45) [Score: 0.85]
#    Validates JWT authentication token
#    Parameters: token: string
#    Returns: boolean
```

### `ast-copilot-helper server`

Start the Model Context Protocol (MCP) server for AI integration.

```bash
# Start stdio server (for Claude Desktop)
ast-copilot-helper server --transport stdio

# Start HTTP server with CORS
ast-copilot-helper server --transport http --port 3001 --cors

# Start SSE server for web clients
ast-copilot-helper server --transport sse --port 3002
```

#### Options

| Option                   | Description                       | Default     |
| ------------------------ | --------------------------------- | ----------- |
| `--transport, -t <type>` | Transport type (stdio, http, sse) | `stdio`     |
| `--port, -p <num>`       | Port for HTTP/SSE server          | `3001`      |
| `--host <address>`       | Host address to bind to           | `localhost` |
| `--cors`                 | Enable CORS for HTTP requests     | `false`     |
| `--auth-token <token>`   | Authentication token              | None        |
| `--max-results <num>`    | Maximum query results             | `50`        |

#### Transport Types

**STDIO Transport:**

```bash
ast-copilot-helper server --transport stdio
# For desktop AI clients (Claude Desktop, etc.)
# Communication via stdin/stdout
```

**HTTP Transport:**

```bash
ast-copilot-helper server --transport http --port 3001 --cors
# RESTful HTTP API
# Accessible at http://localhost:3001
```

**Server-Sent Events (SSE):**

```bash
ast-copilot-helper server --transport sse --port 3002
# Real-time streaming for web clients
# WebSocket-like experience over HTTP
```

#### Security

```bash
# Add authentication token
ast-copilot-helper server --transport http --auth-token "your-secret-token"

# Bind to specific interface
ast-copilot-helper server --transport http --host 0.0.0.0 --port 3001
```

### `ast-copilot-helper config`

Manage configuration settings.

```bash
# Show current configuration
ast-copilot-helper config show

# Validate configuration
ast-copilot-helper config validate

# Set configuration value
ast-copilot-helper config set parser.includePatterns "**/*.{ts,tsx}"

# Get specific value
ast-copilot-helper config get ai.embeddingModel
```

#### Subcommands

**`ast-copilot-helper config show`**

```bash
ast-copilot-helper config show
# Displays complete configuration with comments

ast-copilot-helper config show --format json
# JSON format without comments
```

**`ast-copilot-helper config validate`**

```bash
ast-copilot-helper config validate
# ✅ Configuration is valid
# 📁 Include patterns: **/*.{ts,js,tsx,jsx}
# 🚫 Exclude patterns: node_modules/**, dist/**
# 🤖 AI model: text-embedding-3-small
```

**`ast-copilot-helper config set/get`**

```bash
# Set values
ast-copilot-helper config set parser.languages "typescript,javascript"
ast-copilot-helper config set ai.similarityThreshold 0.8

# Get values
ast-copilot-helper config get parser.includePatterns
ast-copilot-helper config get ai.embeddingModel
```

### `ast-copilot-helper analyze`

Generate comprehensive codebase analysis and reports.

```bash
# Basic analysis
ast-copilot-helper analyze

# Detailed analysis with metrics
ast-copilot-helper analyze --detailed --metrics

# Export analysis to file
ast-copilot-helper analyze --output analysis-report.json

# Analyze specific aspects
ast-copilot-helper analyze --focus complexity,dependencies
```

#### Options

| Option                | Description                    | Default |
| --------------------- | ------------------------------ | ------- |
| `--output, -o <file>` | Output file for report         | stdout  |
| `--format <type>`     | Report format (json, html, md) | `json`  |
| `--detailed`          | Include detailed metrics       | `false` |
| `--metrics`           | Include code metrics           | `false` |
| `--focus <aspects>`   | Focus on specific aspects      | All     |

#### Analysis Aspects

```bash
# Code complexity analysis
ast-copilot-helper analyze --focus complexity

# Dependency analysis
ast-copilot-helper analyze --focus dependencies

# Documentation coverage
ast-copilot-helper analyze --focus documentation

# Security patterns
ast-copilot-helper analyze --focus security
```

### `ast-copilot-helper export`

Export annotations and analysis data.

```bash
# Export all annotations to JSON
ast-copilot-helper export --format json --output annotations.json

# Export specific types
ast-copilot-helper export --type function --format csv

# Export with embeddings
ast-copilot-helper export --include-embeddings --format json
```

#### Options

| Option                 | Description                    | Default   |
| ---------------------- | ------------------------------ | --------- |
| `--format <type>`      | Export format (json, csv, xml) | `json`    |
| `--type <type>`        | Filter by annotation type      | All types |
| `--output, -o <file>`  | Output file path               | stdout    |
| `--include-embeddings` | Include embedding vectors      | `false`   |
| `--pretty`             | Pretty-print JSON output       | `false`   |

## Advanced Usage Patterns

### Batch Processing

```bash
# Parse multiple directories
ast-copilot-helper parse src/ lib/ utils/ --progress

# Query with multiple patterns
ast-copilot-helper query "auth OR login OR signin"

# Export multiple types
for type in function class interface; do
  ast-copilot-helper export --type $type --format json --output "${type}s.json"
done
```

### Pipeline Integration

```bash
#!/bin/bash
# ci-analysis.sh - CI pipeline script

# Parse codebase
ast-copilot-helper parse src/ --quiet

# Generate analysis
ast-copilot-helper analyze --format json --output analysis.json

# Check for issues
if ast-copilot-helper query "TODO OR FIXME" --format json | jq '.length > 5'; then
  echo "Too many TODOs/FIXMEs found"
  exit 1
fi

echo "Analysis complete"
```

### Monitoring Changes

```bash
# Parse and compare with previous version
ast-copilot-helper parse src/ --output current.db
ast-copilot-helper query "new functions since last week" --verbose

# Watch for changes (requires external tool)
fswatch src/ | xargs -I {} ast-copilot-helper parse {}
```

### Custom Queries

```bash
# Complex similarity search
ast-copilot-helper query "error handling" --threshold 0.6 --limit 20

# Combine filters
ast-copilot-helper query "API" --type function --file "**/*controller*" --limit 15

# Case-specific searches
ast-copilot-helper query "authentication middleware" --type function
ast-copilot-helper query "validation schemas" --type interface
ast-copilot-helper query "test utilities" --file "**/*test*"
```

## Configuration via CLI

You can override configuration settings using CLI options:

```bash
# Override include patterns
ast-copilot-helper parse --include "**/*.{ts,tsx,js,jsx}"

# Override AI settings
ast-copilot-helper query "auth" --threshold 0.5

# Override database location
ast-copilot-helper parse src/ --output /tmp/analysis.db
ast-copilot-helper query "functions" --config /tmp/custom-config.json
```

## Error Handling and Debugging

### Verbose Mode

```bash
# Enable verbose logging
ast-copilot-helper parse src/ --verbose

# Combine with specific operations
ast-copilot-helper query "auth" --verbose
ast-copilot-helper server --transport http --verbose
```

### Debugging Parse Issues

```bash
# Parse single file with verbose output
ast-copilot-helper parse problematic-file.ts --verbose

# Check file patterns
ast-copilot-helper config show | grep -E "(include|exclude)"

# Validate configuration
ast-copilot-helper config validate
```

### Common Error Solutions

**No results found:**

```bash
# Check if files were parsed
ast-copilot-helper query "*" --limit 1

# Lower similarity threshold
ast-copilot-helper query "your query" --threshold 0.4

# Check file patterns
ast-copilot-helper config get parser.includePatterns
```

**Permission errors:**

```bash
# Check database permissions
ls -la .ast-copilot-helper.db

# Use custom location
ast-copilot-helper parse src/ --output ~/analysis.db
```

**Memory issues with large codebases:**

```bash
# Limit parallel processing
ast-copilot-helper parse src/ --parallel 2

# Parse incrementally
ast-copilot-helper parse src/components/
ast-copilot-helper parse src/utils/
```

## Integration Examples

### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Parse Codebase",
      "type": "shell",
      "command": "ast-copilot-helper",
      "args": ["parse", "src/", "--progress"],
      "group": "build"
    },
    {
      "label": "Query Functions",
      "type": "shell",
      "command": "ast-copilot-helper",
      "args": ["query", "${input:searchTerm}", "--type", "function"],
      "group": "test"
    }
  ],
  "inputs": [
    {
      "id": "searchTerm",
      "description": "Search term for functions",
      "default": "auth",
      "type": "promptString"
    }
  ]
}
```

### Git Hooks

**Pre-commit hook** (`.git/hooks/pre-commit`):

```bash
#!/bin/bash
# Parse changed files
changed_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|py)$')

if [ -n "$changed_files" ]; then
  echo "Analyzing changed files..."
  echo "$changed_files" | xargs ast-copilot-helper parse --progress
fi
```

### Package.json Scripts

```json
{
  "scripts": {
    "analyze": "ast-copilot-helper parse src/ && ast-copilot-helper analyze --format html --output analysis.html",
    "search": "ast-copilot-helper query",
    "serve-mcp": "ast-copilot-helper server --transport http --port 3001 --cors",
    "export-docs": "ast-copilot-helper export --type function --format json --output docs/api.json"
  }
}
```

## Performance Optimization

### Large Codebases

```bash
# Optimize for speed
ast-copilot-helper parse src/ --parallel 8 --no-embeddings

# Progressive parsing
ast-copilot-helper parse src/core/        # Parse critical files first
ast-copilot-helper parse src/features/    # Then features
ast-copilot-helper parse src/utils/       # Finally utilities
```

### Memory Usage

```bash
# Monitor memory usage
ast-copilot-helper parse src/ --verbose | grep -i memory

# Limit embedding generation
ast-copilot-helper parse src/ --no-embeddings

# Use streaming for large exports
ast-copilot-helper export --format json | jq -c '.[]' > large-export.jsonl
```

## Next Steps

Now that you've mastered the CLI:

- 🎨 **[VS Code Extension Guide](vscode-extension)** - Visual interface for ast-copilot-helper
- ⚙️ **[Configuration Guide](configuration)** - Customize behavior and settings
- 🤖 **[AI Integration Guide](ai-integration)** - Connect with AI agents via MCP
- 🔧 **[Developer Guide](../development/contributing.md)** - Contributing and extending functionality

## CLI Reference Quick Card

```bash
# Essential Commands
ast-copilot-helper init                    # Initialize project
ast-copilot-helper parse src/              # Parse codebase
ast-copilot-helper query "search term"     # Search code
ast-copilot-helper server --transport stdio # Start MCP server

# Common Options
--verbose, -v                      # Verbose output
--help, -h                        # Show help
--config <file>                   # Custom config
--format json                     # JSON output

# Query Filters
--type function                   # Filter by type
--file "**/*test*"               # Filter by file
--limit 20                       # Limit results
--threshold 0.5                 # Similarity threshold
```
