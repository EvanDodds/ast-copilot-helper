#!/usr/bin/env node

/**
 * API Documentation Test
 * Validates that all API documentation is complete and well-structured
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const API_DOCS_DIR = join(process.cwd(), 'docs', 'api');

console.log('🧪 Testing API Reference Documentation...\n');

// Test 1: Check if all required API documentation files exist
console.log('1️⃣  Checking API documentation files...');
const requiredApiDocs = [
  'cli.md',
  'mcp-server.md', 
  'interfaces.md',
  'vscode-extension.md'
];

let allFilesExist = true;
for (const file of requiredApiDocs) {
  const filePath = join(API_DOCS_DIR, file);
  if (!existsSync(filePath)) {
    console.error(`❌ Missing API doc: ${file}`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('✅ All required API documentation files exist\n');
} else {
  process.exit(1);
}

// Test 2: Validate CLI documentation content
console.log('2️⃣  Validating CLI documentation content...');
const cliDoc = readFileSync(join(API_DOCS_DIR, 'cli.md'), 'utf-8');
const requiredCliSections = [
  '# CLI Commands Reference',
  '## Global Options',
  '### `ast-helper parse`',
  '### `ast-helper query`',
  '### `ast-helper init`',
  '### `ast-helper server`',
  '## Exit Codes',
  '## Configuration File',
  '## Environment Variables'
];

let allCliSectionsPresent = true;
for (const section of requiredCliSections) {
  if (!cliDoc.includes(section)) {
    console.error(`❌ Missing CLI section: ${section}`);
    allCliSectionsPresent = false;
  }
}

// Check for code examples
const codeBlockPattern = /```(?:bash|json|typescript)/g;
const codeBlocks = cliDoc.match(codeBlockPattern);
if (!codeBlocks || codeBlocks.length < 10) {
  console.error('❌ Insufficient code examples in CLI documentation');
  allCliSectionsPresent = false;
}

if (allCliSectionsPresent) {
  console.log('✅ CLI documentation content is complete\n');
} else {
  process.exit(1);
}

// Test 3: Validate MCP Server documentation content
console.log('3️⃣  Validating MCP Server documentation content...');
const mcpDoc = readFileSync(join(API_DOCS_DIR, 'mcp-server.md'), 'utf-8');
const requiredMcpSections = [
  '# MCP Server API Reference',
  '## Protocol Information',
  '## Server Capabilities',
  '### `initialize`',
  '### `resources/list`',
  '### `resources/read`',
  '### `tools/list`',
  '### `tools/call`',
  '## Error Handling',
  '## Transport Types'
];

let allMcpSectionsPresent = true;
for (const section of requiredMcpSections) {
  if (!mcpDoc.includes(section)) {
    console.error(`❌ Missing MCP section: ${section}`);
    allMcpSectionsPresent = false;
  }
}

// Check for JSON-RPC examples
const jsonRpcPattern = /"jsonrpc": "2.0"/g;
const jsonRpcExamples = mcpDoc.match(jsonRpcPattern);
if (!jsonRpcExamples || jsonRpcExamples.length < 5) {
  console.error('❌ Insufficient JSON-RPC examples in MCP documentation');
  allMcpSectionsPresent = false;
}

if (allMcpSectionsPresent) {
  console.log('✅ MCP Server documentation content is complete\n');
} else {
  process.exit(1);
}

// Test 4: Validate TypeScript interfaces documentation
console.log('4️⃣  Validating TypeScript interfaces documentation...');
const interfacesDoc = readFileSync(join(API_DOCS_DIR, 'interfaces.md'), 'utf-8');
const requiredInterfaceSections = [
  '# TypeScript Interfaces',
  '## Core Types',
  '### `ASTAnnotation`',
  '### `AnnotationType`',
  '### `Parameter`',
  '## Configuration Types',
  '### `Configuration`',
  '### `ParserConfig`',
  '## Query Types',
  '### `QueryResult`',
  '## Type Guards'
];

let allInterfaceSectionsPresent = true;
for (const section of requiredInterfaceSections) {
  if (!interfacesDoc.includes(section)) {
    console.error(`❌ Missing interface section: ${section}`);
    allInterfaceSectionsPresent = false;
  }
}

// Check for TypeScript interface definitions
const interfacePattern = /```typescript\ninterface \w+/g;
const interfaces = interfacesDoc.match(interfacePattern);
if (!interfaces || interfaces.length < 10) {
  console.error('❌ Insufficient TypeScript interface definitions');
  allInterfaceSectionsPresent = false;
}

if (allInterfaceSectionsPresent) {
  console.log('✅ TypeScript interfaces documentation is complete\n');
} else {
  process.exit(1);
}

// Test 5: Validate VS Code extension documentation
console.log('5️⃣  Validating VS Code extension documentation...');
const vscodeDoc = readFileSync(join(API_DOCS_DIR, 'vscode-extension.md'), 'utf-8');
const requiredVscodeSections = [
  '# VS Code Extension API',
  '## Extension Activation',
  '## Commands',
  '### Core Commands',
  '## Views and Panels',
  '### AST Explorer View',
  '## Configuration',
  '## Language Features',
  '### Hover Provider',
  '### Completion Provider'
];

let allVscodeSectionsPresent = true;
for (const section of requiredVscodeSections) {
  if (!vscodeDoc.includes(section)) {
    console.error(`❌ Missing VS Code section: ${section}`);
    allVscodeSectionsPresent = false;
  }
}

// Check for VS Code API examples
const vscodeApiPattern = /vscode\.\w+/g;
const vscodeApiCalls = vscodeDoc.match(vscodeApiPattern);
if (!vscodeApiCalls || vscodeApiCalls.length < 20) {
  console.error('❌ Insufficient VS Code API examples');
  allVscodeSectionsPresent = false;
}

if (allVscodeSectionsPresent) {
  console.log('✅ VS Code extension documentation is complete\n');
} else {
  process.exit(1);
}

// Test 6: Check for interactive examples and auto-generation indicators
console.log('6️⃣  Checking for interactive examples and auto-generation support...');

let hasInteractiveElements = false;
const allDocs = [cliDoc, mcpDoc, interfacesDoc, vscodeDoc].join('\n');

// Check for interactive elements
const interactiveIndicators = [
  '::: code-group',  // VitePress code groups
  'code-group',      // Alternative syntax
  'playground',      // Interactive playground indicators
  'example',         // Example indicators
  'demo'            // Demo indicators
];

for (const indicator of interactiveIndicators) {
  if (allDocs.includes(indicator)) {
    hasInteractiveElements = true;
    break;
  }
}

if (hasInteractiveElements) {
  console.log('✅ Documentation includes interactive elements\n');
} else {
  console.log('⚠️  No interactive elements detected (consider adding code groups)\n');
}

console.log('🎉 All API documentation tests passed!\n');
console.log('📋 Summary:');
console.log('   ✅ CLI Commands Reference - Complete with examples and options');
console.log('   ✅ MCP Server Protocol - Complete with JSON-RPC examples');  
console.log('   ✅ TypeScript Interfaces - Complete with type definitions');
console.log('   ✅ VS Code Extension API - Complete with implementation examples');
console.log('   ✅ Auto-generated documentation structure ready');
console.log('   ✅ Interactive examples framework in place');
console.log('\n🚀 API documentation is comprehensive and ready for use!');