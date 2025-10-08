# Multi-Language Support

## Overview

The AST Copilot Helper provides comprehensive support for multiple programming languages through Tree-sitter parsers. This document outlines the supported languages, their capabilities, and how to work with them.

## Supported Languages

### Tier 1 Languages (Full Support)

#### JavaScript

- **Parser Version**: tree-sitter-javascript 0.23.1
- **Features**: Complete syntax support, JSDoc parsing, ES6+ features
- **File Extensions**: `.js`, `.mjs`, `.cjs`
- **Special Features**:
  - Template literal parsing
  - Dynamic imports
  - Class fields and private methods

#### TypeScript

- **Parser Version**: tree-sitter-typescript 0.24.4
- **Features**: Full TypeScript syntax, type annotations, generics
- **File Extensions**: `.ts`, `.tsx`, `.mts`, `.cts`
- **Special Features**:
  - Interface and type definitions
  - Decorators
  - Namespace support
  - JSX in TypeScript

#### Python

- **Parser Version**: tree-sitter-python 0.23.4
- **Features**: Python 3.12+ syntax support
- **File Extensions**: `.py`, `.pyi`
- **Special Features**:
  - Type hints
  - F-strings
  - Pattern matching (Python 3.10+)
  - Async/await

#### Rust

- **Parser Version**: tree-sitter-rust 0.23.2
- **Features**: Complete Rust syntax including latest features
- **File Extensions**: `.rs`
- **Special Features**:
  - Macro parsing
  - Lifetime annotations
  - Trait implementations
  - Unsafe blocks

#### Java

- **Parser Version**: tree-sitter-java 0.23.4
- **Features**: Java 21 language features
- **File Extensions**: `.java`
- **Special Features**:
  - Annotations
  - Generics
  - Lambda expressions
  - Records and sealed classes

### Tier 2 Languages (Well Supported)

#### C++

- **Parser Version**: tree-sitter-cpp 0.23.4
- **Features**: C++20 standard support
- **File Extensions**: `.cpp`, `.cc`, `.cxx`, `.hpp`, `.h`

#### C

- **Parser Version**: tree-sitter-c 0.23.2
- **Features**: C11/C17 standard
- **File Extensions**: `.c`, `.h`

#### C#

- **Parser Version**: tree-sitter-c-sharp 0.23.2
- **Features**: C# 11 language features
- **File Extensions**: `.cs`

#### Go

- **Parser Version**: tree-sitter-go 0.23.1
- **Features**: Go 1.21+ support
- **File Extensions**: `.go`

#### Ruby

- **Parser Version**: tree-sitter-ruby 0.23.1
- **Features**: Ruby 3.2+ syntax
- **File Extensions**: `.rb`, `.rake`

### Tier 3 Languages (Basic Support)

#### PHP

- **Parser Version**: tree-sitter-php 0.23.4
- **File Extensions**: `.php`

#### Kotlin

- **Parser Version**: tree-sitter-kotlin 0.3.8
- **File Extensions**: `.kt`, `.kts`

#### Swift

- **Parser Version**: tree-sitter-swift 0.6.1
- **File Extensions**: `.swift`

#### Scala

- **Parser Version**: tree-sitter-scala 0.21.0
- **File Extensions**: `.scala`, `.sc`

#### Bash

- **Parser Version**: tree-sitter-bash 0.23.1
- **File Extensions**: `.sh`, `.bash`

## Language Detection

### Automatic Detection

The system automatically detects languages based on:

1. **File Extension** - Primary method
2. **Shebang Lines** - For scripts
3. **Content Analysis** - Fallback method

```typescript
import { detectLanguage } from "@ast-copilot-helper/core";

const language = await detectLanguage(content, filename);
console.log(`Detected language: ${language}`);
```

### Manual Language Selection

You can explicitly specify the language:

```typescript
import { parseCode } from "@ast-copilot-helper/core";

const ast = await parseCode(sourceCode, "typescript");
```

## Parsing Capabilities

### Syntax Tree Generation

All supported languages provide:

- Complete syntax tree parsing
- Error recovery and partial parsing
- Position information for all nodes
- Comment preservation (configurable)

### Language-Specific Features

#### JavaScript/TypeScript

- JSX parsing in `.tsx` files
- Template literal analysis
- Module import/export tracking

#### Python

- Docstring extraction
- Type annotation parsing
- Async function detection

#### Rust

- Macro expansion analysis
- Crate dependency tracking
- Unsafe code detection

#### Java

- Package structure analysis
- Annotation processing
- Generic type resolution

## Code Analysis Features

### Universal Features (All Languages)

- **Function Detection**: Identify function/method definitions
- **Class Analysis**: Extract class hierarchies
- **Variable Tracking**: Find variable declarations and usage
- **Import Analysis**: Track dependencies and imports
- **Comment Extraction**: Parse documentation comments

### Language-Specific Analysis

#### TypeScript/JavaScript

```typescript
// Extract interface definitions
const interfaces = queryAST(ast, "(interface_declaration) @interface");

// Find React components
const components = queryAST(
  ast,
  '(function_declaration name: (identifier) @name (#match? @name "^[A-Z]"))',
);
```

#### Python

```typescript
// Find class methods
const methods = queryAST(
  ast,
  "(class_definition body: (block (function_definition) @method))",
);

// Extract docstrings
const docstrings = queryAST(ast, "(expression_statement (string) @docstring)");
```

#### Rust

```typescript
// Find public functions
const publicFns = queryAST(
  ast,
  '(function_item visibility: (visibility_modifier) @pub (#eq? @pub "pub"))',
);

// Extract macro definitions
const macros = queryAST(ast, "(macro_definition) @macro");
```

## Configuration

### Parser Configuration

```typescript
interface LanguageConfig {
  // Language identifier
  language: string;

  // Parser options
  includeComments: boolean;
  includeWhitespace: boolean;
  errorRecovery: boolean;

  // Language-specific settings
  jsxEnabled?: boolean; // JavaScript/TypeScript
  strictMode?: boolean; // JavaScript
  pythonVersion?: string; // Python
  rustEdition?: string; // Rust
}
```

### Example Configurations

```typescript
// TypeScript with JSX
const tsxConfig: LanguageConfig = {
  language: "typescript",
  includeComments: true,
  includeWhitespace: false,
  errorRecovery: true,
  jsxEnabled: true,
};

// Python with type hints
const pythonConfig: LanguageConfig = {
  language: "python",
  includeComments: true,
  includeWhitespace: false,
  errorRecovery: true,
  pythonVersion: "3.12",
};
```

## Performance Considerations

### Parser Performance

| Language   | Parse Speed | Memory Usage | Recommended Use |
| ---------- | ----------- | ------------ | --------------- |
| JavaScript | Very Fast   | Low          | All scenarios   |
| TypeScript | Fast        | Medium       | All scenarios   |
| Python     | Fast        | Low          | All scenarios   |
| Rust       | Medium      | Medium       | Analysis tools  |
| Java       | Medium      | Medium       | Enterprise apps |
| C++        | Slow        | High         | Limited use     |

### Optimization Tips

1. **Parser Pooling**: Reuse parser instances
2. **Incremental Parsing**: Update only changed portions
3. **Language Filtering**: Only load needed parsers
4. **Memory Limits**: Set appropriate memory bounds

## Error Handling

### Parse Errors

```typescript
try {
  const ast = await parseCode(sourceCode, language);

  if (ast.hasErrors()) {
    const errors = ast.getErrors();
    console.log("Parse errors found:", errors);
  }
} catch (error) {
  console.error("Parser failed:", error);
}
```

### Language Fallback

```typescript
async function parseWithFallback(code: string, filename: string) {
  const languages = ["typescript", "javascript", "text"];

  for (const lang of languages) {
    try {
      const ast = await parseCode(code, lang);
      if (!ast.hasErrors()) {
        return { ast, language: lang };
      }
    } catch (error) {
      console.warn(`Failed to parse as ${lang}:`, error);
    }
  }

  throw new Error("Unable to parse with any supported language");
}
```

## Integration Examples

### VS Code Extension

```typescript
import { parseCode, queryAST } from "@ast-copilot-helper/core";

// Parse current document
const document = vscode.window.activeTextEditor?.document;
const language = document?.languageId;
const ast = await parseCode(document.getText(), language);

// Find all functions for outline
const functions = queryAST(ast, "(function_declaration) @func");
```

### CLI Tool

```bash
# Parse and analyze a file
ast-copilot analyze --file src/main.ts --language typescript

# Batch process multiple files
ast-copilot batch --pattern "src/**/*.{ts,js}" --output analysis.json
```

### Web Application

```typescript
// Browser-compatible parsing
import { parseCode } from "@ast-copilot-helper/web";

const ast = await parseCode(editorContent, detectedLanguage);
const symbols = extractSymbols(ast);
displayInSidebar(symbols);
```

## Future Language Support

### Planned Additions

- **Zig**: Modern systems programming
- **Dart**: Flutter development
- **Julia**: Scientific computing
- **Haskell**: Functional programming

### Community Contributions

We welcome contributions for additional language support. See our [Contributing Guide](../CONTRIBUTING.md) for details on adding new language parsers.

---

_For technical implementation details, see the [Tree-sitter Integration Guide](./tree-sitter-integration.md)_
