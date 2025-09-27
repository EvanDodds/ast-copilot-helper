# API Reference

Welcome to the AST Copilot Helper API documentation. This section provides comprehensive reference material for integrating AST Copilot Helper into your applications.

## Available APIs

### [CLI Commands](/api/cli)

Complete command-line interface reference with all available commands, options, and usage examples.

### [MCP Server](/api/mcp-server)

Model Context Protocol server API for AI agent integration, including tool definitions and resource endpoints.

### [TypeScript Interfaces](/api/interfaces)

Type definitions and interfaces for programmatic integration with AST Copilot Helper libraries.

### [VS Code Extension](/api/vscode-extension)

Extension API and configuration options for Visual Studio Code integration.

## Quick Start

The easiest way to get started with the API is through the CLI:

```bash
# Install globally
npm install -g ast-copilot-helper

# Basic usage
ast-copilot-helper parse ./src --format json
```

For programmatic usage:

```typescript
import { ASTProcessor } from "ast-copilot-helper";

const processor = new ASTProcessor();
const result = await processor.parseDirectory("./src");
```

## Integration Patterns

### MCP Integration

For AI agents and Model Context Protocol integration, see the [MCP Server documentation](/api/mcp-server).

### Library Integration

For direct library usage in your applications, refer to the [TypeScript Interfaces](/api/interfaces).

### CLI Automation

For build tools and CI/CD integration, check the [CLI Commands](/api/cli) reference.

## Support

- 📖 [Getting Started Guide](/guide/getting-started)
- 🔧 [Configuration Guide](/guide/configuration)
- ❓ [FAQ](/faq)
- 🐛 [Troubleshooting](/troubleshooting)
