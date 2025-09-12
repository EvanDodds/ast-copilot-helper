#!/usr/bin/env node

/**
 * CLI entry point for ast-mcp-server
 * This file will be expanded in future issues to implement the actual MCP server functionality
 */

export function main(): void {
  console.log('ast-mcp-server CLI - Structure initialized');
  console.log('This MCP server will serve AST data from .astdb/ database');
}

// Only execute if this file is run directly
// eslint-disable-next-line @typescript-eslint/no-var-requires
const isMainModule = require.main === module;
if (isMainModule) {
  main();
}
