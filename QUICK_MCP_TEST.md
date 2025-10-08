# Quick Start: Testing MCP Client Integration

## Prerequisites

1. Build the project: `yarn build`
2. Ensure MCP server is built: `cd packages/ast-mcp-server && yarn build`

## Launch Extension Development Host

```bash
# From project root
code .
# Press F5 (or Run > Start Debugging)
```

## Quick Test Sequence

### 1. Check Server Status (30 seconds)

1. Open Output panel: `View > Output`
2. Select "AST Helper Server" from dropdown
3. Look for:
   - ✅ "MCP server started successfully"
   - ✅ "MCP client connected successfully"
   - ✅ "Server capabilities:" with tools listed

### 2. Check Status Bar (5 seconds)

- Look at bottom-right status bar
- Should see: `$(check) AST Helper` (green)
- Click it to open output channel

### 3. Test Basic Tool Call (2 minutes)

Add to `packages/vscode-extension/src/extension.ts`:

```typescript
// In activate() function, after other setup
const testMCP = vscode.commands.registerCommand(
  "ast-helper.testMCP",
  async () => {
    try {
      const client = clientManager?.getClient();
      if (!client) {
        vscode.window.showErrorMessage("MCP client not connected");
        return;
      }

      // Test 1: Get index status
      const status = await client.callTool({
        name: "ast_index_status",
        arguments: {},
      });

      console.log("Tool result:", status);
      vscode.window.showInformationMessage(
        `Tool call succeeded: ${JSON.stringify(status).substring(0, 100)}...`,
      );

      // Test 2: List tools
      const tools = await client.listTools();
      console.log(
        "Available tools:",
        tools.tools.map((t) => t.name),
      );
      vscode.window.showInformationMessage(
        `Found ${tools.tools.length} tools available`,
      );
    } catch (error) {
      console.error("MCP test failed:", error);
      vscode.window.showErrorMessage(`MCP test failed: ${error.message}`);
    }
  },
);

context.subscriptions.push(testMCP);
```

Then in Command Palette: `AST Helper: Test MCP`

### 4. Test Reconnection (1 minute)

```bash
# Get PID from output channel
ps aux | grep ast-mcp-server

# Kill process
kill -9 <PID>

# Check output channel for:
# - "Transport closed"
# - "Attempting to reconnect"
# - "MCP client connected successfully"
```

### 5. Test Error Handling (30 seconds)

Add to test command:

```typescript
// Test invalid tool name
try {
  await client.callTool({
    name: "nonexistent_tool",
    arguments: {},
  });
} catch (error) {
  console.log("Expected error:", error.message);
  // Should see: "Tool not found: nonexistent_tool"
}
```

## Expected Results

✅ **Success Indicators:**

- Server starts without errors
- Client connects within 2 seconds
- Tool calls return data
- Reconnection works after kill
- Errors are caught and logged

❌ **Failure Indicators:**

- "Server process not available" error
- "Failed to parse JSON-RPC message" errors
- Connection timeout
- Tool calls hang or crash extension

## Common Issues

### Server Won't Start

```bash
# Check server build
cd packages/ast-mcp-server
yarn build
ls -la dist/index.js

# Check server runs standalone
node dist/index.js --stdio
# (Ctrl+C to exit)
```

### Client Won't Connect

- Check Output channel for errors
- Verify server path in extension configuration
- Check if port 3000 is already in use

### Tools Don't Work

- Verify server capabilities include tools
- Check tool name spelling (case-sensitive)
- Verify arguments match schema

## Debugging Commands

```bash
# View extension logs
code --log-extension-host-communication

# Check process
ps aux | grep ast-mcp-server | grep -v grep

# Monitor output
tail -f /tmp/ast-mcp-server.log  # If logging to file

# Chrome DevTools
# In Extension Development Host: Help > Toggle Developer Tools
```

## Next Steps After Testing

1. Document any bugs in issue tracker
2. Update `MCP_CLIENT_INTEGRATION_STATUS.md` with results
3. Fix critical issues before moving to next feature
4. Update todo list with completion status

## Full Testing Guide

For comprehensive testing, see: `packages/vscode-extension/MANUAL_MCP_TESTING.md`

## Status Document

For implementation details, see: `MCP_CLIENT_INTEGRATION_STATUS.md`
