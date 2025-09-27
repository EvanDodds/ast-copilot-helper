# MCP Server API Reference

The ast-copilot-helper MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io) for seamless AI agent integration.

## Protocol Information

- **Protocol Version**: `2024-11-05`
- **Transport**: stdio, Server-Sent Events (SSE), or WebSocket
- **Message Format**: JSON-RPC 2.0
- **Authentication**: Optional token-based authentication

## Server Capabilities

The MCP server advertises the following capabilities:

```json
{
  "resources": {
    "subscribe": true,
    "listChanged": true
  },
  "tools": {
    "listChanged": false
  },
  "prompts": {
    "listChanged": false
  },
  "logging": {}
}
```

## Methods

### Core Protocol Methods

#### `initialize`

Initialize the MCP server with client information.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {
        "subscribe": true
      },
      "tools": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {
        "subscribe": true,
        "listChanged": true
      },
      "tools": {
        "listChanged": false
      },
      "prompts": {
        "listChanged": false
      }
    },
    "serverInfo": {
      "name": "ast-copilot-helper",
      "version": "1.0.0"
    }
  }
}
```

#### `initialized`

Notification sent by client after successful initialization.

**Notification:**

```json
{
  "jsonrpc": "2.0",
  "method": "initialized",
  "params": {}
}
```

### Resource Methods

#### `resources/list`

List all available resources (parsed code files and annotations).

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list",
  "params": {}
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resources": [
      {
        "uri": "ast://project/src/users.ts",
        "name": "users.ts",
        "description": "User management functions and types",
        "mimeType": "application/json"
      },
      {
        "uri": "ast://project/src/auth.ts",
        "name": "auth.ts",
        "description": "Authentication and authorization logic",
        "mimeType": "application/json"
      }
    ]
  }
}
```

#### `resources/read`

Read the content of a specific resource.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "ast://project/src/users.ts"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "contents": [
      {
        "uri": "ast://project/src/users.ts",
        "mimeType": "application/json",
        "text": "{\"annotations\": [{\"id\": \"func_getUserById\", \"type\": \"function\", \"name\": \"getUserById\", \"description\": \"Retrieves user by ID\", \"parameters\": [{\"name\": \"id\", \"type\": \"string\"}], \"returnType\": \"Promise<User>\"}]}"
      }
    ]
  }
}
```

#### `resources/subscribe`

Subscribe to resource changes.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/subscribe",
  "params": {
    "uri": "ast://project/src/users.ts"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {}
}
```

### Tool Methods

#### `tools/list`

List all available tools for code analysis and querying.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/list",
  "params": {}
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "tools": [
      {
        "name": "parse_files",
        "description": "Parse source code files and extract AST annotations",
        "inputSchema": {
          "type": "object",
          "properties": {
            "files": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of file paths to parse"
            },
            "options": {
              "type": "object",
              "properties": {
                "recursive": { "type": "boolean" },
                "includeComments": { "type": "boolean" },
                "language": { "type": "string" }
              }
            }
          },
          "required": ["files"]
        }
      },
      {
        "name": "query_annotations",
        "description": "Query parsed annotations using semantic search",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Natural language query"
            },
            "options": {
              "type": "object",
              "properties": {
                "limit": { "type": "number", "default": 10 },
                "threshold": { "type": "number", "default": 0.7 },
                "type": { "type": "string" }
              }
            }
          },
          "required": ["query"]
        }
      },
      {
        "name": "analyze_code",
        "description": "Perform detailed code analysis",
        "inputSchema": {
          "type": "object",
          "properties": {
            "file": {
              "type": "string",
              "description": "File path to analyze"
            },
            "analysisType": {
              "type": "string",
              "enum": ["complexity", "dependencies", "patterns", "security"],
              "description": "Type of analysis to perform"
            }
          },
          "required": ["file", "analysisType"]
        }
      }
    ]
  }
}
```

#### `tools/call`

Call a specific tool with arguments.

**Parse Files Example:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "parse_files",
    "arguments": {
      "files": ["src/users.ts", "src/auth.ts"],
      "options": {
        "recursive": true,
        "includeComments": true
      }
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully parsed 2 files and extracted 15 annotations.\n\nFiles processed:\n- src/users.ts: 8 annotations (5 functions, 2 classes, 1 interface)\n- src/auth.ts: 7 annotations (4 functions, 2 classes, 1 enum)\n\nAnnotations are now available for querying."
      },
      {
        "type": "resource",
        "resource": {
          "uri": "ast://project/annotations",
          "mimeType": "application/json",
          "text": "{\"totalFiles\": 2, \"totalAnnotations\": 15, \"summary\": {\"functions\": 9, \"classes\": 4, \"interfaces\": 1, \"enums\": 1}}"
        }
      }
    ],
    "isError": false
  }
}
```

**Query Annotations Example:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "query_annotations",
    "arguments": {
      "query": "functions that handle user authentication",
      "options": {
        "limit": 5,
        "threshold": 0.8
      }
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 functions related to user authentication:\n\n1. loginUser (src/auth.ts:23) - Authenticates user with email/password\n2. validateToken (src/auth.ts:45) - Validates JWT authentication token\n3. refreshToken (src/auth.ts:67) - Refreshes expired authentication token\n\nAll results have similarity score > 0.8"
      },
      {
        "type": "resource",
        "resource": {
          "uri": "ast://project/query-results",
          "mimeType": "application/json",
          "text": "[{\"id\": \"func_loginUser\", \"name\": \"loginUser\", \"file\": \"src/auth.ts\", \"line\": 23, \"similarity\": 0.89}, {\"id\": \"func_validateToken\", \"name\": \"validateToken\", \"file\": \"src/auth.ts\", \"line\": 45, \"similarity\": 0.85}, {\"id\": \"func_refreshToken\", \"name\": \"refreshToken\", \"file\": \"src/auth.ts\", \"line\": 67, \"similarity\": 0.82}]"
        }
      }
    ],
    "isError": false
  }
}
```

### Notification Methods

#### `resources/updated`

Notification sent when resources change.

**Notification:**

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "uri": "ast://project/src/users.ts"
  }
}
```

## Error Handling

The server returns standard JSON-RPC 2.0 error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "parameter": "files",
      "reason": "must be a non-empty array"
    }
  }
}
```

### Error Codes

| Code     | Name             | Description                                  |
| -------- | ---------------- | -------------------------------------------- |
| `-32700` | Parse Error      | Invalid JSON was received                    |
| `-32600` | Invalid Request  | The JSON sent is not a valid Request object  |
| `-32601` | Method Not Found | The method does not exist / is not available |
| `-32602` | Invalid Params   | Invalid method parameter(s)                  |
| `-32603` | Internal Error   | Internal JSON-RPC error                      |
| `-32000` | Server Error     | Server-specific error                        |
| `-32001` | Parse Failed     | File parsing failed                          |
| `-32002` | Database Error   | Database operation failed                    |
| `-32003` | File Not Found   | Requested file does not exist                |

## Transport Types

### stdio

Standard input/output transport for command-line usage:

```bash
ast-copilot-helper server --transport stdio
```

The server reads JSON-RPC messages from stdin and writes responses to stdout.

### Server-Sent Events (SSE)

HTTP-based transport using Server-Sent Events:

```bash
ast-copilot-helper server --transport sse --port 3001
```

**Client Connection:**

```http
GET /sse HTTP/1.1
Host: localhost:3001
Accept: text/event-stream
```

**Send Request:**

```http
POST /message HTTP/1.1
Host: localhost:3001
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {...}
}
```

### WebSocket

WebSocket transport for real-time communication:

```bash
ast-copilot-helper server --transport websocket --port 8080
```

**Client Connection:**

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.send(JSON.stringify({
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {...}
}));
```

## Authentication

Optional token-based authentication:

```bash
ast-copilot-helper server --auth mySecretToken
```

**Request with Authentication:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client",
      "version": "1.0.0"
    },
    "auth": {
      "type": "bearer",
      "token": "mySecretToken"
    }
  }
}
```

## Rate Limiting

The server implements rate limiting to prevent abuse:

- Default: 100 requests per minute per client
- Configurable via `--rate-limit` option
- Returns HTTP 429 (Too Many Requests) when exceeded

## Configuration

Server configuration via `.ast-copilot-helper.json`:

```json
{
  "server": {
    "port": 3001,
    "host": "localhost",
    "transport": "stdio",
    "auth": {
      "enabled": false,
      "token": "secretToken"
    },
    "rateLimit": {
      "enabled": true,
      "requests": 100,
      "window": 60000
    },
    "cors": {
      "enabled": false,
      "origins": ["https://localhost:3000"]
    },
    "logging": {
      "level": "info",
      "file": "mcp-server.log"
    }
  }
}
```
