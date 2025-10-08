# Manual Testing Guide: MCP Client Integration

This guide documents how to manually test the MCP client integration with the real MCP SDK. These tests should be performed in the VS Code extension development host to verify the implementation works correctly.

## Setup

1. Open this project in VS Code
2. Press `F5` to start the Extension Development Host
3. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
4. Look for "AST Helper" commands

## Test 1: Server Startup and Connection

###Expected Behavior

When the extension activates (if autoStart is enabled):

1. Open "AST Helper Server" output channel
2. Should see:
   ```
   Server Process Manager initialized
   Server path: /path/to/packages/ast-mcp-server/dist/index.js
   Working directory: /path/to/workspace
   Starting MCP server...
   MCP server started successfully (PID: XXXX)
   MCP Client Manager initialized
   Connecting to MCP server...
   MCP client connected successfully
   Server capabilities: { tools: {...}, resources: {...} }
   ```

### Success Criteria

- ✅ Server process starts without errors
- ✅ Client connects to server
- ✅ Server capabilities received and logged
- ✅ No error messages in output channel

## Test 2: Status Bar Integration

### Expected Behavior

1. Look at VS Code status bar (bottom right)
2. Should see "AST Helper" status item
3. When connected: Shows `$(check) AST Helper` (green checkmark)
4. When disconnected: Shows `$(x) AST Helper` (red X)
5. Click status item to open output channel

### Success Criteria

- ✅ Status item visible in status bar
- ✅ Status updates in real-time
- ✅ Tooltip shows connection information
- ✅ Clicking opens output channel

## Test 3: Server Capabilities

### Expected Behavior

After connection, the server should expose its capabilities:

1. Check output channel logs
2. Should see available tools listed:
   - `query_ast_context`
   - `ast_file_query`
   - `ast_index_status`
   - `ast_find_references`
   - `ast_find_definitions`
   - `ast_symbol_search`
   - (and others)

### Success Criteria

- ✅ All expected tools are listed
- ✅ Tool descriptions and schemas are present
- ✅ Resources capability exposed (if applicable)

## Test 4: Tool Invocation

### Test 4.1: ast_index_status Tool

**Manual Test:**
Add temporary test code to extension:

```typescript
// In extension.ts or a command handler
const clientManager = // get MCPClientManager instance
const client = clientManager.getClient();

if (client) {
  const result = await client.callTool({
    name: "ast_index_status",
    arguments: {}
  });
  console.log("Tool result:", result);
}
```

**Expected Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Index status: X files indexed, Y symbols total"
    }
  ]
}
```

### Test 4.2: Error Handling - Invalid Tool Name

**Manual Test:**

```typescript
try {
  await client.callTool({
    name: "non_existent_tool",
    arguments: {},
  });
} catch (error) {
  console.log("Expected error:", error);
}
```

**Expected Error:**

```
Error: Tool not found: non_existent_tool
```

### Test 4.3: Error Handling - Invalid Arguments

**Manual Test:**

```typescript
try {
  await client.callTool({
    name: "ast_file_query",
    arguments: {}, // Missing required 'file_path'
  });
} catch (error) {
  console.log("Expected error:", error);
}
```

**Expected Error:**

```
Error: Missing required argument: file_path
```

### Success Criteria

- ✅ Tool calls return expected results
- ✅ Errors are caught and logged appropriately
- ✅ Extension does not crash on errors
- ✅ Response format matches MCP protocol

## Test 5: Reconnection Handling

### Test 5.1: Detect Server Crash

**Manual Test:**

1. Note the server PID from output channel
2. Kill the process: `kill -9 <PID>`
3. Check output channel

**Expected Logs:**

```
Transport closed
Client state changed: connected -> disconnected
Attempting to reconnect (attempt 1/5)...
Starting MCP server...
MCP server started successfully
Reconnecting client...
MCP client connected successfully
```

### Test 5.2: Manual Server Restart

**Manual Test:**

1. Run command: "AST Helper: Restart Server"
2. Check output channel

**Expected Logs:**

```
Restarting MCP server...
Stopping MCP server...
MCP server stopped
Starting MCP server...
MCP server started successfully (PID: XXXX)
Reconnecting client...
MCP client connected successfully
```

### Success Criteria

- ✅ Disconnect detected within heartbeat interval (default 30s)
- ✅ Automatic reconnection attempts occur
- ✅ Status bar updates to show disconnected state
- ✅ Status bar updates back to connected after reconnection
- ✅ No zombie processes left behind
- ✅ Tools work after reconnection

## Test 6: Transport Message Handling

### Test 6.1: Large Responses

**Manual Test:**
Call a tool that returns a large response (e.g., query on a large file):

```typescript
const result = await client.callTool({
  name: "query_ast_context",
  arguments: {
    query: "find all functions",
    max_results: 100,
  },
});
```

**Expected Behavior:**

- Response should be complete (not truncated)
- No buffer overflow warnings in logs
- All data accessible and properly parsed

### Test 6.2: Concurrent Requests

**Manual Test:**

```typescript
const promises = [
  client.listTools(),
  client.callTool({ name: "ast_index_status", arguments: {} }),
  client.listResources(),
];

const results = await Promise.all(promises);
console.log("All results:", results);
```

**Expected Behavior:**

- All 3 requests complete successfully
- No race conditions or corrupted messages
- Responses arrive in correct order
- No JSON parsing errors

### Test 6.3: Malformed JSON Handling

**Expected Behavior** (automatic):
If server sends invalid JSON, Transport should:

- Log error: "Failed to parse JSON-RPC message: ..."
- Not crash the extension
- Continue processing other messages

### Success Criteria

- ✅ Large responses handled without truncation
- ✅ Concurrent requests complete successfully
- ✅ Malformed messages logged but don't crash extension
- ✅ Newline-delimited JSON parsing works correctly

## Test 7: Performance and Reliability

### Test 7.1: Extended Connection Stability

**Manual Test:**

1. Leave extension running for 30+ minutes
2. Periodically check status bar (should stay green)
3. Make tool calls after extended idle time

**Expected Behavior:**

- Heartbeat keeps connection alive
- No unexpected disconnects
- Tool calls work after idle period
- No memory leaks (check Task Manager/Activity Monitor)

### Test 7.2: Rapid Connect/Disconnect Cycles

**Manual Test:**

1. Rapidly toggle server on/off using commands
2. Or repeatedly call start() and stop()

**Expected Behavior:**

- Clean state transitions
- No crashes or errors
- No zombie processes
- No resource leaks

### Success Criteria

- ✅ Connection stable over extended period
- ✅ Heartbeat prevents timeouts
- ✅ No memory leaks
- ✅ Clean shutdown on extension deactivation
- ✅ Handles rapid start/stop cycles

## Test 8: VS Code Integration

### Test 8.1: Workspace Changes

**Manual Test:**

1. Close and reopen workspace
2. Server should stop and restart

**Expected Behavior:**

- Server stops gracefully on workspace close
- Server starts on workspace open (if autoStart enabled)
- Client reconnects automatically

### Test 8.2: Extension Deactivation

**Manual Test:**

1. Disable the extension
2. Check that server process stops

**Expected Behavior:**

- Server process terminates
- No orphaned processes
- Clean shutdown logged

### Success Criteria

- ✅ Handles workspace changes correctly
- ✅ Clean deactivation with no orphaned processes
- ✅ Extension can be reactivated without issues

## Debugging Tips

### View Logs

- **Extension Output:** Output panel → "AST Helper Server"
- **MCP Server Logs:** Check stderr from server process
- **Chrome DevTools:** Help → Toggle Developer Tools

### Common Issues

1. **"Server process not available"**
   - Check server path in configuration
   - Verify `packages/ast-mcp-server/dist/index.js` exists
   - Run `yarn build` to rebuild server

2. **"Failed to parse JSON-RPC message"**
   - Check server stdout for non-JSON output
   - Verify server uses newline-delimited JSON
   - Check for stderr contamination of stdout

3. **Connection timeout**
   - Increase `connectionTimeout` in configuration
   - Check if server is stuck in startup
   - Verify server responds to initialization

4. **Heartbeat failures**
   - Check network/IPC latency
   - Verify server responds to ping
   - Adjust `heartbeatInterval` if needed

## Success Checklist

Before considering MCP client integration complete, verify:

- ✅ Server starts and client connects successfully
- ✅ Status bar shows correct connection state
- ✅ All tools can be called and return results
- ✅ Error handling works for invalid tool/args
- ✅ Reconnection works after server crash
- ✅ Transport handles large responses
- ✅ Concurrent requests work correctly
- ✅ Connection stable over extended period
- ✅ Clean shutdown on extension deactivation
- ✅ No memory leaks or zombie processes

## Next Steps

After manual testing is complete:

1. **Document findings** in issue tracker
2. **Fix any bugs** discovered during testing
3. **Add unit tests** for critical paths (where possible with VS Code mocking)
4. **Update user documentation** with any configuration needed
5. **Prepare for end-to-end testing** with real workspaces
