# CLI Usage Guide

Master the ast-copilot-helper command-line interface with this comprehensive guide covering all commands, options, and usage patterns.

## Overview

The `ast-helper` CLI provides powerful tools for parsing, querying, and managing code analysis. This guide covers everything from basic usage to advanced techniques.

## Global Options

These options work with all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--config <file>` | Path to configuration file | `.ast-helper.json` |
| `--verbose, -v` | Enable verbose logging | `false` |
| `--quiet, -q` | Suppress non-error output | `false` |
| `--help, -h` | Show help for command | - |
| `--version` | Show version information | - |

## Core Commands

### `ast-helper init`

Initialize ast-copilot-helper in your project.

```bash
# Initialize with interactive prompts
ast-helper init

# Initialize with specific language
ast-helper init --language typescript

# Initialize for monorepo
ast-helper init --workspace-root ./packages

# Skip interactive prompts (use defaults)
ast-helper init --yes
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--language, -l <lang>` | Primary language (typescript, javascript, python) | Auto-detect |
| `--workspace-root <dir>` | Root directory for analysis | Current directory |
| `--include <patterns>` | File patterns to include | Language defaults |
| `--exclude <patterns>` | File patterns to exclude | `node_modules/**` |
| `--yes, -y` | Skip interactive prompts | `false` |

#### Examples

```bash
# TypeScript project with specific patterns
ast-helper init -l typescript --include "src/**/*.ts" --exclude "**/*.test.ts"

# Python project with custom workspace
ast-helper init -l python --workspace-root ./my-python-app

# Quick setup with defaults
ast-helper init -y
```

### `ast-helper parse`

Parse source files and extract AST annotations.

```bash
# Parse all files in src directory
ast-helper parse src/

# Parse specific files
ast-helper parse file1.ts file2.js

# Parse with custom patterns
ast-helper parse "**/*.{ts,js}" --exclude "**/*.test.*"

# Parse and show progress
ast-helper parse src/ --progress
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--include <patterns>` | File patterns to include | Config default |
| `--exclude <patterns>` | File patterns to exclude | Config default |
| `--language <lang>` | Force specific language | Auto-detect |
| `--output, -o <file>` | Output database file | `.ast-helper.db` |
| `--format <type>` | Output format (db, json) | `db` |
| `--progress` | Show parsing progress | `false` |
| `--parallel <num>` | Max parallel processes | CPU count |
| `--force` | Overwrite existing database | `false` |

#### Examples

```bash
# Parse with progress and custom output
ast-helper parse src/ --progress --output analysis.db

# Parse only TypeScript files
ast-helper parse "**/*.ts" --language typescript

# Force reparse everything
ast-helper parse src/ --force

# Parse with limited parallelism
ast-helper parse src/ --parallel 2

# Export to JSON instead of database
ast-helper parse src/ --format json --output annotations.json
```

#### Output Formats

**Database Format (Default):**
```bash
ast-helper parse src/
# Creates .ast-helper.db SQLite database
```

**JSON Format:**
```bash
ast-helper parse src/ --format json --output annotations.json
# Creates annotations.json with all extracted data
```

### `ast-helper query`

Search your codebase using natural language or specific filters.

```bash
# Natural language search
ast-helper query "authentication functions"

# Search for specific types
ast-helper query "API endpoints" --type function

# Get detailed results
ast-helper query "error handling" --verbose

# Limit results
ast-helper query "database operations" --limit 5
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--type <type>` | Filter by annotation type | All types |
| `--file <pattern>` | Filter by file pattern | All files |
| `--limit, -l <num>` | Maximum results to return | 10 |
| `--similarity <num>` | Similarity threshold (0-1) | 0.7 |
| `--format <type>` | Output format (table, json, detailed) | `table` |
| `--sort <field>` | Sort by field (score, name, file) | `score` |
| `--no-embeddings` | Use text search instead of semantic | `false` |

#### Query Types

**Natural Language:**
```bash
ast-helper query "functions that handle user authentication"
ast-helper query "error handling and exception management"
ast-helper query "API endpoints for user data"
ast-helper query "utility functions for string manipulation"
```

**Type-Specific:**
```bash
ast-helper query "*" --type function      # All functions
ast-helper query "*" --type class         # All classes
ast-helper query "*" --type interface     # All interfaces
ast-helper query "*" --type variable      # All variables
```

**File-Specific:**
```bash
ast-helper query "database" --file "**/*model*"    # Only model files
ast-helper query "auth" --file "src/auth/**"       # Only auth directory
ast-helper query "test" --file "**/*.test.ts"      # Only test files
```

#### Output Formats

**Table Format (Default):**
```bash
ast-helper query "auth functions"
# ┌─────────────────┬──────────────────┬───────┬─────────┐
# │ Name            │ File             │ Line  │ Score   │
# ├─────────────────┼──────────────────┼───────┼─────────┤
# │ authenticateUser│ src/auth.ts      │ 23    │ 0.89    │
# │ validateToken   │ src/auth.ts      │ 45    │ 0.85    │
# └─────────────────┴──────────────────┴───────┴─────────┘
```

**JSON Format:**
```bash
ast-helper query "auth functions" --format json
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
ast-helper query "auth functions" --format detailed
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

### `ast-helper server`

Start the Model Context Protocol (MCP) server for AI integration.

```bash
# Start stdio server (for Claude Desktop)
ast-helper server --transport stdio

# Start HTTP server with CORS
ast-helper server --transport http --port 3001 --cors

# Start SSE server for web clients
ast-helper server --transport sse --port 3002
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--transport, -t <type>` | Transport type (stdio, http, sse) | `stdio` |
| `--port, -p <num>` | Port for HTTP/SSE server | `3001` |
| `--host <address>` | Host address to bind to | `localhost` |
| `--cors` | Enable CORS for HTTP requests | `false` |
| `--auth-token <token>` | Authentication token | None |
| `--max-results <num>` | Maximum query results | `50` |

#### Transport Types

**STDIO Transport:**
```bash
ast-helper server --transport stdio
# For desktop AI clients (Claude Desktop, etc.)
# Communication via stdin/stdout
```

**HTTP Transport:**
```bash
ast-helper server --transport http --port 3001 --cors
# RESTful HTTP API
# Accessible at http://localhost:3001
```

**Server-Sent Events (SSE):**
```bash
ast-helper server --transport sse --port 3002
# Real-time streaming for web clients
# WebSocket-like experience over HTTP
```

#### Security

```bash
# Add authentication token
ast-helper server --transport http --auth-token "your-secret-token"

# Bind to specific interface
ast-helper server --transport http --host 0.0.0.0 --port 3001
```

### `ast-helper config`

Manage configuration settings.

```bash
# Show current configuration
ast-helper config show

# Validate configuration
ast-helper config validate

# Set configuration value
ast-helper config set parser.includePatterns "**/*.{ts,tsx}"

# Get specific value
ast-helper config get ai.embeddingModel
```

#### Subcommands

**`ast-helper config show`**
```bash
ast-helper config show
# Displays complete configuration with comments

ast-helper config show --format json
# JSON format without comments
```

**`ast-helper config validate`**
```bash
ast-helper config validate
# ✅ Configuration is valid
# 📁 Include patterns: **/*.{ts,js,tsx,jsx}
# 🚫 Exclude patterns: node_modules/**, dist/**
# 🤖 AI model: text-embedding-3-small
```

**`ast-helper config set/get`**
```bash
# Set values
ast-helper config set parser.languages "typescript,javascript"
ast-helper config set ai.similarityThreshold 0.8

# Get values
ast-helper config get parser.includePatterns
ast-helper config get ai.embeddingModel
```

### `ast-helper analyze`

Generate comprehensive codebase analysis and reports.

```bash
# Basic analysis
ast-helper analyze

# Detailed analysis with metrics
ast-helper analyze --detailed --metrics

# Export analysis to file
ast-helper analyze --output analysis-report.json

# Analyze specific aspects
ast-helper analyze --focus complexity,dependencies
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output, -o <file>` | Output file for report | stdout |
| `--format <type>` | Report format (json, html, md) | `json` |
| `--detailed` | Include detailed metrics | `false` |
| `--metrics` | Include code metrics | `false` |
| `--focus <aspects>` | Focus on specific aspects | All |

#### Analysis Aspects

```bash
# Code complexity analysis
ast-helper analyze --focus complexity

# Dependency analysis
ast-helper analyze --focus dependencies

# Documentation coverage
ast-helper analyze --focus documentation

# Security patterns
ast-helper analyze --focus security
```

### `ast-helper export`

Export annotations and analysis data.

```bash
# Export all annotations to JSON
ast-helper export --format json --output annotations.json

# Export specific types
ast-helper export --type function --format csv

# Export with embeddings
ast-helper export --include-embeddings --format json
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--format <type>` | Export format (json, csv, xml) | `json` |
| `--type <type>` | Filter by annotation type | All types |
| `--output, -o <file>` | Output file path | stdout |
| `--include-embeddings` | Include embedding vectors | `false` |
| `--pretty` | Pretty-print JSON output | `false` |

## Advanced Usage Patterns

### Batch Processing

```bash
# Parse multiple directories
ast-helper parse src/ lib/ utils/ --progress

# Query with multiple patterns
ast-helper query "auth OR login OR signin"

# Export multiple types
for type in function class interface; do
  ast-helper export --type $type --format json --output "${type}s.json"
done
```

### Pipeline Integration

```bash
#!/bin/bash
# ci-analysis.sh - CI pipeline script

# Parse codebase
ast-helper parse src/ --quiet

# Generate analysis
ast-helper analyze --format json --output analysis.json

# Check for issues
if ast-helper query "TODO OR FIXME" --format json | jq '.length > 5'; then
  echo "Too many TODOs/FIXMEs found"
  exit 1
fi

echo "Analysis complete"
```

### Monitoring Changes

```bash
# Parse and compare with previous version
ast-helper parse src/ --output current.db
ast-helper query "new functions since last week" --verbose

# Watch for changes (requires external tool)
fswatch src/ | xargs -I {} ast-helper parse {}
```

### Custom Queries

```bash
# Complex similarity search
ast-helper query "error handling" --similarity 0.6 --limit 20

# Combine filters
ast-helper query "API" --type function --file "**/*controller*" --limit 15

# Case-specific searches
ast-helper query "authentication middleware" --type function
ast-helper query "validation schemas" --type interface
ast-helper query "test utilities" --file "**/*test*"
```

## Configuration via CLI

You can override configuration settings using CLI options:

```bash
# Override include patterns
ast-helper parse --include "**/*.{ts,tsx,js,jsx}"

# Override AI settings
ast-helper query "auth" --similarity 0.5

# Override database location
ast-helper parse src/ --output /tmp/analysis.db
ast-helper query "functions" --config /tmp/custom-config.json
```

## Error Handling and Debugging

### Verbose Mode

```bash
# Enable verbose logging
ast-helper parse src/ --verbose

# Combine with specific operations
ast-helper query "auth" --verbose
ast-helper server --transport http --verbose
```

### Debugging Parse Issues

```bash
# Parse single file with verbose output
ast-helper parse problematic-file.ts --verbose

# Check file patterns
ast-helper config show | grep -E "(include|exclude)"

# Validate configuration
ast-helper config validate
```

### Common Error Solutions

**No results found:**
```bash
# Check if files were parsed
ast-helper query "*" --limit 1

# Lower similarity threshold
ast-helper query "your query" --similarity 0.4

# Check file patterns
ast-helper config get parser.includePatterns
```

**Permission errors:**
```bash
# Check database permissions
ls -la .ast-helper.db

# Use custom location
ast-helper parse src/ --output ~/analysis.db
```

**Memory issues with large codebases:**
```bash
# Limit parallel processing
ast-helper parse src/ --parallel 2

# Parse incrementally
ast-helper parse src/components/
ast-helper parse src/utils/
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
      "command": "ast-helper",
      "args": ["parse", "src/", "--progress"],
      "group": "build"
    },
    {
      "label": "Query Functions",
      "type": "shell",
      "command": "ast-helper", 
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
  echo "$changed_files" | xargs ast-helper parse --progress
fi
```

### Package.json Scripts

```json
{
  "scripts": {
    "analyze": "ast-helper parse src/ && ast-helper analyze --format html --output analysis.html",
    "search": "ast-helper query",
    "serve-mcp": "ast-helper server --transport http --port 3001 --cors",
    "export-docs": "ast-helper export --type function --format json --output docs/api.json"
  }
}
```

## Performance Optimization

### Large Codebases

```bash
# Optimize for speed
ast-helper parse src/ --parallel 8 --no-embeddings

# Progressive parsing
ast-helper parse src/core/        # Parse critical files first
ast-helper parse src/features/    # Then features
ast-helper parse src/utils/       # Finally utilities
```

### Memory Usage

```bash
# Monitor memory usage
ast-helper parse src/ --verbose | grep -i memory

# Limit embedding generation
ast-helper parse src/ --no-embeddings

# Use streaming for large exports
ast-helper export --format json | jq -c '.[]' > large-export.jsonl
```

## Next Steps

Now that you've mastered the CLI:

- 🎨 **[VS Code Extension Guide](vscode-extension)** - Visual interface for ast-helper
- ⚙️ **[Configuration Guide](configuration)** - Customize behavior and settings
- 🤖 **[AI Integration Guide](ai-integration)** - Connect with AI agents via MCP
- 🔧 **[Developer Guide](../development)** - Contributing and extending functionality

## CLI Reference Quick Card

```bash
# Essential Commands
ast-helper init                    # Initialize project
ast-helper parse src/              # Parse codebase  
ast-helper query "search term"     # Search code
ast-helper server --transport stdio # Start MCP server

# Common Options
--verbose, -v                      # Verbose output
--help, -h                        # Show help
--config <file>                   # Custom config
--format json                     # JSON output

# Query Filters  
--type function                   # Filter by type
--file "**/*test*"               # Filter by file
--limit 20                       # Limit results
--similarity 0.5                 # Similarity threshold
```