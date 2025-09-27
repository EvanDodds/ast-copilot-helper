# Configuration Guide

Master AST Copilot Helper configuration to tailor the tool perfectly for your project needs. This comprehensive guide covers all configuration options, patterns, and best practices.

## Configuration Overview

AST Copilot Helper uses a hierarchical configuration system:

1. **Default Configuration** - Built-in sensible defaults
2. **Global Configuration** - User-wide settings (`~/.ast-copilot-helper.json`)
3. **Project Configuration** - Project-specific (`.ast-copilot-helper.json`)
4. **CLI Overrides** - Command-line arguments (highest priority)

## Configuration File Structure

The main configuration file `.ast-copilot-helper.json` contains these sections:

```json
{
  "parser": {
    /* Code parsing settings */
  },
  "ai": {
    /* AI and embedding settings */
  },
  "search": {
    /* Search behavior settings */
  },
  "server": {
    /* MCP server settings */
  },
  "output": {
    /* Output formatting settings */
  },
  "performance": {
    /* Performance optimization */
  },
  "logging": {
    /* Logging and debugging */
  }
}
```

## Parser Configuration

### Basic Parsing Settings

```json
{
  "parser": {
    "languages": ["typescript", "javascript", "python"],
    "includePatterns": ["**/*.{ts,js,py}"],
    "excludePatterns": ["node_modules/**", "dist/**", ".git/**"],
    "maxFileSize": "1MB",
    "followSymlinks": false,
    "encoding": "utf8"
  }
}
```

#### Supported Languages

| Language     | Extensions            | AST Parser              |
| ------------ | --------------------- | ----------------------- |
| `typescript` | `.ts`, `.tsx`         | TypeScript Compiler API |
| `javascript` | `.js`, `.jsx`, `.mjs` | Babel Parser            |
| `python`     | `.py`, `.pyi`         | Tree-sitter Python      |
| `java`       | `.java`               | Tree-sitter Java        |
| `go`         | `.go`                 | Tree-sitter Go          |
| `rust`       | `.rs`                 | Tree-sitter Rust        |
| `cpp`        | `.cpp`, `.h`, `.hpp`  | Tree-sitter C++         |

#### File Patterns

**Include Patterns:**

```json
{
  "parser": {
    "includePatterns": [
      "src/**/*.{ts,tsx}", // Source TypeScript files
      "lib/**/*.js", // Library JavaScript files
      "**/*.py", // All Python files
      "packages/*/src/**/*.ts" // Monorepo pattern
    ]
  }
}
```

**Exclude Patterns:**

```json
{
  "parser": {
    "excludePatterns": [
      "node_modules/**", // Dependencies
      "dist/**", // Build output
      "build/**", // Build artifacts
      "**/*.test.{ts,js}", // Test files
      "**/*.spec.{ts,js}", // Spec files
      "**/*.min.js", // Minified files
      "**/vendor/**", // Third-party code
      ".git/**", // Git directory
      "coverage/**" // Coverage reports
    ]
  }
}
```

#### Advanced Parsing Options

```json
{
  "parser": {
    "extractComments": true,
    "extractJSDoc": true,
    "includePrivateMembers": false,
    "includeInternalAPIs": false,
    "resolveImports": true,
    "parseTypeDefinitions": true,
    "maxDepth": 10,
    "skipSyntaxErrors": true,
    "preserveSourceMaps": false
  }
}
```

### Language-Specific Settings

```json
{
  "parser": {
    "languages": {
      "typescript": {
        "compilerOptions": {
          "target": "es2020",
          "module": "commonjs",
          "strict": true,
          "skipLibCheck": true
        },
        "includeDeclarations": true,
        "extractTypes": true
      },
      "javascript": {
        "plugins": ["jsx", "decorators-legacy"],
        "sourceType": "module",
        "allowReturnOutsideFunction": true
      },
      "python": {
        "version": "3.9",
        "extractDocstrings": true,
        "includePrivateMembers": false,
        "followImports": "normal"
      }
    }
  }
}
```

## AI and Embedding Configuration

### Embedding Models

```json
{
  "ai": {
    "embeddingModel": "text-embedding-3-small",
    "embeddingDimensions": 1536,
    "provider": "openai",
    "apiKey": "${OPENAI_API_KEY}",
    "apiEndpoint": "https://api.openai.com/v1",
    "timeout": 30000,
    "retryAttempts": 3
  }
}
```

#### Supported Providers

**OpenAI:**

```json
{
  "ai": {
    "provider": "openai",
    "embeddingModel": "text-embedding-3-small", // or "text-embedding-3-large"
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

**Azure OpenAI:**

```json
{
  "ai": {
    "provider": "azure-openai",
    "embeddingModel": "text-embedding-ada-002",
    "apiKey": "${AZURE_OPENAI_API_KEY}",
    "apiEndpoint": "https://your-resource.openai.azure.com/",
    "apiVersion": "2023-12-01-preview"
  }
}
```

**Local/Ollama:**

```json
{
  "ai": {
    "provider": "ollama",
    "embeddingModel": "nomic-embed-text",
    "apiEndpoint": "http://localhost:11434",
    "timeout": 60000
  }
}
```

**Hugging Face:**

```json
{
  "ai": {
    "provider": "huggingface",
    "embeddingModel": "sentence-transformers/all-MiniLM-L6-v2",
    "apiKey": "${HUGGINGFACE_API_KEY}"
  }
}
```

### Embedding Options

```json
{
  "ai": {
    "batchSize": 100,
    "enableCaching": true,
    "cacheExpiry": 604800, // 7 days in seconds
    "chunkSize": 8192,
    "chunkOverlap": 200,
    "normalizeEmbeddings": true,
    "similarityFunction": "cosine" // "cosine", "euclidean", "dot-product"
  }
}
```

## Search Configuration

### Search Behavior

```json
{
  "search": {
    "defaultSimilarityThreshold": 0.7,
    "maxResults": 20,
    "enableSemanticSearch": true,
    "enableFuzzySearch": true,
    "enableRegexSearch": false,
    "caseSensitive": false,
    "highlightMatches": true
  }
}
```

### Ranking and Scoring

```json
{
  "search": {
    "scoring": {
      "semanticWeight": 0.7,
      "textMatchWeight": 0.2,
      "locationWeight": 0.1,
      "boostFactors": {
        "exportedFunctions": 1.2,
        "publicMethods": 1.1,
        "mainFiles": 1.3,
        "recentFiles": 1.1
      }
    }
  }
}
```

### Search Index Settings

```json
{
  "search": {
    "indexing": {
      "updateOnFileChange": true,
      "backgroundIndexing": true,
      "maxIndexSize": "100MB",
      "enableFullTextIndex": true,
      "stemming": true,
      "stopWords": ["the", "a", "an", "and", "or", "but"]
    }
  }
}
```

## MCP Server Configuration

### Server Settings

```json
{
  "server": {
    "transport": "stdio",
    "port": 3001,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000", "https://claude.ai"],
      "methods": ["GET", "POST", "OPTIONS"],
      "headers": ["Content-Type", "Authorization"]
    }
  }
}
```

### Security Settings

```json
{
  "server": {
    "authentication": {
      "enabled": true,
      "method": "bearer",
      "token": "${MCP_AUTH_TOKEN}",
      "tokenFile": ".mcp-token"
    },
    "rateLimit": {
      "enabled": true,
      "requests": 1000,
      "window": 3600, // 1 hour
      "message": "Rate limit exceeded"
    },
    "timeout": 30000,
    "maxPayloadSize": "10MB"
  }
}
```

### Protocol Configuration

```json
{
  "server": {
    "protocol": {
      "version": "2024-11-05",
      "capabilities": {
        "resources": true,
        "tools": true,
        "prompts": true,
        "logging": true
      },
      "maxContextSize": 32768,
      "enableStreaming": true,
      "compression": "gzip"
    }
  }
}
```

## Output Configuration

### Formatting Options

```json
{
  "output": {
    "format": "table", // "table", "json", "yaml", "csv"
    "verbosity": "normal", // "quiet", "normal", "verbose", "debug"
    "colors": true,
    "unicode": true,
    "timestamps": false,
    "showProgress": true
  }
}
```

### Export Settings

```json
{
  "output": {
    "export": {
      "includeMetadata": true,
      "includeEmbeddings": false,
      "prettify": true,
      "compression": "none", // "none", "gzip", "brotli"
      "maxFileSize": "50MB",
      "splitLargeFiles": true
    }
  }
}
```

## Performance Configuration

### Memory and Processing

```json
{
  "performance": {
    "maxWorkers": 4, // CPU cores for parallel processing
    "maxMemory": "2GB", // Memory limit for operations
    "chunkProcessing": true,
    "lazyLoading": true,
    "cacheSize": "100MB",
    "diskCache": true,
    "tempDirectory": "/tmp/ast-copilot-helper"
  }
}
```

### Database Optimization

```json
{
  "performance": {
    "database": {
      "engine": "sqlite", // "sqlite", "postgresql"
      "connectionPool": 5,
      "queryTimeout": 10000,
      "enableWAL": true, // Write-Ahead Logging
      "cacheSize": 10000, // Pages
      "synchronous": "NORMAL", // "OFF", "NORMAL", "FULL"
      "journalMode": "WAL" // "DELETE", "WAL", "MEMORY"
    }
  }
}
```

## Logging Configuration

### Log Levels and Output

```json
{
  "logging": {
    "level": "info", // "error", "warn", "info", "debug", "trace"
    "outputs": ["console", "file"],
    "file": ".ast-copilot-helper.log",
    "maxFileSize": "10MB",
    "maxFiles": 5,
    "format": "json", // "text", "json"
    "includeTimestamp": true,
    "includeLocation": false
  }
}
```

### Debug Configuration

```json
{
  "logging": {
    "debug": {
      "enableProfiling": false,
      "profileOutput": "profile.json",
      "traceSQL": false,
      "traceParsing": false,
      "traceEmbeddings": false,
      "memoryUsage": true
    }
  }
}
```

## Environment Variables

### Common Environment Variables

```bash
# AI Configuration
export OPENAI_API_KEY="sk-..."
export AZURE_OPENAI_API_KEY="..."
export HUGGINGFACE_API_KEY="..."

# MCP Server
export MCP_AUTH_TOKEN="secure-token-here"
export MCP_PORT=3001
export MCP_HOST="0.0.0.0"

# Database
export AST_HELPER_DB_PATH="/custom/path/ast-copilot-helper.db"
export AST_HELPER_CACHE_DIR="/custom/cache"

# Performance
export AST_HELPER_MAX_WORKERS=8
export AST_HELPER_MAX_MEMORY="4GB"

# Logging
export AST_HELPER_LOG_LEVEL="debug"
export AST_HELPER_LOG_FILE="/var/log/ast-copilot-helper.log"
```

### Configuration with Environment Variables

```json
{
  "ai": {
    "apiKey": "${OPENAI_API_KEY}",
    "embeddingModel": "${EMBEDDING_MODEL:-text-embedding-3-small}"
  },
  "server": {
    "port": "${MCP_PORT:-3001}",
    "host": "${MCP_HOST:-localhost}"
  },
  "performance": {
    "maxWorkers": "${MAX_WORKERS:-4}",
    "maxMemory": "${MAX_MEMORY:-2GB}"
  }
}
```

## Project-Specific Configurations

### TypeScript Project

```json
{
  "parser": {
    "languages": ["typescript"],
    "includePatterns": ["src/**/*.ts", "src/**/*.tsx", "lib/**/*.ts"],
    "excludePatterns": [
      "**/*.test.ts",
      "**/*.spec.ts",
      "dist/**",
      "coverage/**"
    ],
    "languages": {
      "typescript": {
        "compilerOptions": {
          "target": "es2020",
          "module": "commonjs",
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true
        },
        "includeDeclarations": true,
        "extractTypes": true
      }
    }
  },
  "ai": {
    "embeddingModel": "text-embedding-3-small"
  },
  "search": {
    "defaultSimilarityThreshold": 0.75
  }
}
```

### Python Project

```json
{
  "parser": {
    "languages": ["python"],
    "includePatterns": ["**/*.py", "**/*.pyi"],
    "excludePatterns": [
      "**/__pycache__/**",
      "**/test_*.py",
      "**/*_test.py",
      "dist/**",
      "build/**",
      ".venv/**"
    ],
    "languages": {
      "python": {
        "version": "3.9",
        "extractDocstrings": true,
        "includePrivateMembers": false
      }
    }
  },
  "search": {
    "defaultSimilarityThreshold": 0.7,
    "enableFuzzySearch": true
  }
}
```

### Monorepo Configuration

```json
{
  "parser": {
    "includePatterns": [
      "packages/*/src/**/*.{ts,tsx,js,jsx}",
      "apps/*/src/**/*.{ts,tsx,js,jsx}",
      "libs/**/*.{ts,tsx,js,jsx}"
    ],
    "excludePatterns": [
      "packages/*/node_modules/**",
      "packages/*/dist/**",
      "packages/*/.next/**",
      "**/*.test.*"
    ]
  },
  "ai": {
    "batchSize": 50,
    "enableCaching": true
  },
  "performance": {
    "maxWorkers": 8,
    "chunkProcessing": true
  }
}
```

### Microservices Project

```json
{
  "parser": {
    "includePatterns": [
      "services/*/src/**/*.{ts,js}",
      "shared/**/*.{ts,js}",
      "common/**/*.{ts,js}"
    ]
  },
  "search": {
    "scoring": {
      "boostFactors": {
        "sharedCode": 1.5,
        "serviceMain": 1.3,
        "apiEndpoints": 1.4
      }
    }
  },
  "server": {
    "cors": {
      "enabled": true,
      "origins": ["*"]
    }
  }
}
```

## Configuration Validation

### Validate Configuration

```bash
# Check configuration validity
ast-copilot-helper config validate

# Show computed configuration
ast-copilot-helper config show

# Test specific settings
ast-copilot-helper config test --section parser
ast-copilot-helper config test --section ai
```

### Common Validation Errors

**Invalid file patterns:**

```json
{
  "parser": {
    // ❌ Invalid - missing quotes
    "includePatterns": [**/*.ts],

    // ✅ Valid
    "includePatterns": ["**/*.ts"]
  }
}
```

**Missing required fields:**

```json
{
  "ai": {
    // ❌ Missing apiKey when using OpenAI
    "provider": "openai",
    "embeddingModel": "text-embedding-3-small"
  }
}
```

**Type mismatches:**

```json
{
  "search": {
    // ❌ Should be number, not string
    "maxResults": "20",

    // ✅ Correct type
    "maxResults": 20
  }
}
```

## Configuration Templates

### Minimal Configuration

```json
{
  "parser": {
    "includePatterns": ["src/**/*.{ts,js}"]
  }
}
```

### Development Configuration

```json
{
  "parser": {
    "languages": ["typescript", "javascript"],
    "includePatterns": ["src/**/*.{ts,tsx,js,jsx}"],
    "excludePatterns": ["**/*.test.*", "dist/**"]
  },
  "ai": {
    "embeddingModel": "text-embedding-3-small",
    "enableCaching": true
  },
  "search": {
    "defaultSimilarityThreshold": 0.7,
    "maxResults": 20
  },
  "logging": {
    "level": "info",
    "outputs": ["console"]
  }
}
```

### Production Configuration

```json
{
  "parser": {
    "languages": ["typescript"],
    "includePatterns": ["dist/**/*.js"],
    "maxFileSize": "5MB"
  },
  "ai": {
    "provider": "azure-openai",
    "embeddingModel": "text-embedding-ada-002",
    "apiEndpoint": "https://your-resource.openai.azure.com/",
    "enableCaching": true,
    "cacheExpiry": 86400
  },
  "server": {
    "authentication": {
      "enabled": true,
      "method": "bearer"
    },
    "rateLimit": {
      "enabled": true,
      "requests": 500,
      "window": 3600
    }
  },
  "logging": {
    "level": "warn",
    "outputs": ["file"],
    "file": "/var/log/ast-copilot-helper.log"
  }
}
```

## Best Practices

### File Organization

```
project/
├── .ast-copilot-helper.json              # Main configuration
├── .ast-copilot-helper.local.json        # Local overrides (gitignored)
├── config/
│   ├── ast-copilot-helper.dev.json      # Development config
│   ├── ast-copilot-helper.prod.json     # Production config
│   └── ast-copilot-helper.test.json     # Testing config
└── .env                         # Environment variables
```

### Security Considerations

1. **Never commit API keys:**

   ```json
   {
     "ai": {
       "apiKey": "${OPENAI_API_KEY}" // ✅ Use environment variable
     }
   }
   ```

2. **Use authentication in production:**

   ```json
   {
     "server": {
       "authentication": {
         "enabled": true,
         "tokenFile": ".mcp-token" // ✅ Separate token file
       }
     }
   }
   ```

3. **Restrict CORS origins:**
   ```json
   {
     "server": {
       "cors": {
         "origins": ["https://your-domain.com"] // ✅ Specific origins
       }
     }
   }
   ```

### Performance Optimization

1. **Exclude unnecessary files:**

   ```json
   {
     "parser": {
       "excludePatterns": [
         "node_modules/**",
         "**/*.min.js",
         "vendor/**",
         "**/*.generated.*"
       ]
     }
   }
   ```

2. **Optimize for large codebases:**

   ```json
   {
     "performance": {
       "maxWorkers": 8,
       "chunkProcessing": true,
       "lazyLoading": true
     }
   }
   ```

3. **Use caching effectively:**
   ```json
   {
     "ai": {
       "enableCaching": true,
       "cacheExpiry": 604800
     }
   }
   ```

## Configuration Management

### Multiple Environments

```bash
# Use different configs for different environments
ast-copilot-helper parse --config config/ast-copilot-helper.dev.json
ast-copilot-helper parse --config config/ast-copilot-helper.prod.json

# Environment-specific commands
npm run dev:parse    # Uses dev config
npm run prod:parse   # Uses prod config
```

### Configuration Inheritance

```json
// config/base.json
{
  "parser": {
    "languages": ["typescript", "javascript"]
  }
}

// config/development.json
{
  "extends": "./base.json",
  "logging": {
    "level": "debug"
  }
}
```

### Dynamic Configuration

```bash
# Override settings via environment
SIMILARITY_THRESHOLD=0.8 ast-copilot-helper query "auth functions"

# Use config from different location
ast-copilot-helper parse --config /path/to/config.json
```

## Troubleshooting Configuration

### Common Issues

**Configuration not found:**

```bash
# Check current config location
ast-copilot-helper config show --source

# Use explicit config path
ast-copilot-helper parse --config .ast-copilot-helper.json
```

**Invalid JSON syntax:**

```bash
# Validate JSON syntax
ast-copilot-helper config validate
# Or use online JSON validator
```

**Environment variables not resolved:**

```bash
# Check environment variables
echo $OPENAI_API_KEY

# Test variable resolution
ast-copilot-helper config show | grep apiKey
```

**Performance issues:**

```bash
# Check current settings
ast-copilot-helper config show --section performance

# Profile parsing performance
ast-copilot-helper parse --verbose --profile
```

## Next Steps

With configuration mastered:

- 🤖 **[AI Integration Guide](ai-integration)** - Connect with AI agents and optimize AI settings
- 🚀 **[CLI Usage Guide](cli-usage)** - Use advanced CLI features with custom configurations
- 🎨 **[VS Code Extension](vscode-extension)** - Apply configurations in VS Code environment
- 🛠️ **[Developer Guide](../development/contributing.md)** - Contributing and extending configuration options

## Configuration Quick Reference

### Essential Settings

```json
{
  "parser": {
    "includePatterns": ["src/**/*.{ts,js}"],
    "excludePatterns": ["node_modules/**"]
  },
  "ai": {
    "embeddingModel": "text-embedding-3-small",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "search": {
    "defaultSimilarityThreshold": 0.7,
    "maxResults": 20
  }
}
```

### Environment Variables

```bash
export OPENAI_API_KEY="sk-..."
export MCP_AUTH_TOKEN="secure-token"
export AST_HELPER_LOG_LEVEL="info"
```

### Validation Commands

```bash
ast-copilot-helper config validate    # Check configuration
ast-copilot-helper config show       # Display current config
ast-copilot-helper config test       # Test specific sections
```
