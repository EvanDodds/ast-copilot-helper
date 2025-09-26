# MCP Integration Guide

The AST Copilot Helper provides a Model Context Protocol (MCP) server that enables AI agents to understand and query your codebase intelligently.

## What is MCP?

Model Context Protocol (MCP) is an open standard that enables AI applications to securely access external data sources and tools. Our MCP server acts as a bridge between AI agents and your code analysis capabilities.

## Quick Setup

### 1. Install AST Copilot Helper

```bash
npm install -g ast-copilot-helper
```

### 2. Start the MCP Server

```bash
ast-copilot-helper mcp-server --port 3000
```

### 3. Configure Your AI Agent

Add the MCP server configuration to your AI agent (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "ast-copilot-helper": {
      "command": "npx",
      "args": ["ast-copilot-helper", "mcp-server"],
      "env": {
        "WORKSPACE_PATH": "/path/to/your/project"
      }
    }
  }
}
```

## Available Tools

The MCP server provides several tools for code analysis:

### `analyze_codebase`

Perform semantic analysis of your codebase

- **Input**: Directory path, analysis options
- **Output**: AST data, code metrics, dependencies

### `search_code`

Search for specific patterns or functions

- **Input**: Search query, file patterns
- **Output**: Matching code snippets with context

### `get_file_info`

Get detailed information about a specific file

- **Input**: File path
- **Output**: AST structure, imports, exports, functions

### `query_dependencies`

Analyze project dependencies and relationships

- **Input**: Package or module name
- **Output**: Dependency tree, usage patterns

## Configuration

### Environment Variables

- `WORKSPACE_PATH`: Root directory of your project
- `AST_DB_PATH`: Custom database path for caching
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Server Options

```bash
ast-copilot-helper mcp-server \
  --port 3000 \
  --workspace /path/to/project \
  --cache-dir /path/to/cache \
  --languages typescript,python,javascript
```

## Claude Desktop Integration

### 1. Install Claude Desktop

Download from [Claude's official website](https://claude.ai/desktop).

### 2. Configure MCP Server

Add to your Claude Desktop configuration file (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ast-copilot-helper": {
      "command": "ast-copilot-helper",
      "args": ["mcp-server", "--workspace", "/path/to/your/project"]
    }
  }
}
```

### 3. Restart Claude Desktop

Claude will automatically connect to the MCP server on startup.

## Usage Examples

Once configured, you can ask Claude to analyze your code:

> "Can you analyze the main function in my TypeScript project and explain its dependencies?"

> "Find all functions that use the React useState hook"

> "Show me the import/export relationships in my API modules"

## Troubleshooting

### Server Won't Start

- Check that Node.js is installed and accessible
- Verify the workspace path exists and is readable
- Check port availability (default: 3000)

### Agent Can't Connect

- Ensure the MCP server is running
- Verify the configuration file syntax
- Check agent logs for connection errors

### Poor Analysis Results

- Ensure your project is built/compiled
- Check that supported languages are detected
- Verify file permissions for the workspace

## Advanced Configuration

### Custom Analysis Rules

Create a `.ast-copilot.json` configuration file:

```json
{
  "languages": ["typescript", "python", "rust"],
  "excludePatterns": ["node_modules", "*.test.ts"],
  "analysisDepth": "deep",
  "cacheEnabled": true
}
```

### Security Considerations

The MCP server runs with the permissions of the user account. To enhance security:

- Run in a restricted environment
- Use read-only workspace permissions when possible
- Configure firewall rules for the MCP port
- Use authentication tokens in production

## API Reference

For detailed API documentation, see the [MCP Server API Reference](/api/mcp-server).

## Next Steps

- [API Reference](/api/mcp-server) - Detailed MCP server API
- [Configuration Guide](/guide/configuration) - Advanced configuration options
- [Examples](/examples/integrations) - Integration examples with various AI tools
