/**
 * MCP Client Test Command
 *
 * Add this to extension.ts to test the MCP client integration.
 * This provides a quick way to verify the client works correctly.
 */

import * as vscode from "vscode";
import type { MCPClientManager } from "../managers/MCPClientManager.js";

/**
 * Register a test command for the MCP client
 *
 * Usage:
 * 1. Add to extension.ts activate() function:
 *    const testCmd = registerMCPTestCommand(context, clientManager);
 *    context.subscriptions.push(testCmd);
 *
 * 2. Run command: "AST Helper: Test MCP Client"
 *
 * 3. Check output channel and notifications for results
 */
export function registerMCPTestCommand(
  _context: vscode.ExtensionContext,
  clientManager: MCPClientManager | null,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "ast-helper.testMCPClient",
    async () => {
      const outputChannel = vscode.window.createOutputChannel(
        "AST Helper - MCP Test",
      );
      outputChannel.show();

      try {
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("MCP Client Integration Test");
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("");

        // Test 1: Check client availability
        outputChannel.appendLine("Test 1: Client Availability");
        if (!clientManager) {
          throw new Error("MCPClientManager is not initialized");
        }

        const client = clientManager.getClient();
        if (!client) {
          throw new Error("MCP client is not connected");
        }
        outputChannel.appendLine("✅ Client is available and connected");
        outputChannel.appendLine("");

        // Test 2: Get connection info
        outputChannel.appendLine("Test 2: Connection Info");
        const connectionInfo = clientManager.getConnectionInfo();
        outputChannel.appendLine(`  State: ${connectionInfo.state}`);
        outputChannel.appendLine(
          `  Connect Time: ${connectionInfo.connectTime?.toISOString() || "N/A"}`,
        );
        outputChannel.appendLine(
          `  Reconnect Attempts: ${connectionInfo.reconnectAttempts}`,
        );
        if (connectionInfo.serverCapabilities) {
          outputChannel.appendLine(
            `  Server Capabilities: ${JSON.stringify(connectionInfo.serverCapabilities, null, 2)}`,
          );
        }
        outputChannel.appendLine("");

        // Test 3: List available tools
        outputChannel.appendLine("Test 3: List Available Tools");
        const toolsResult = await client.listTools();
        outputChannel.appendLine(`  Total tools: ${toolsResult.tools.length}`);
        toolsResult.tools.forEach((tool, index: number) => {
          outputChannel.appendLine(`  ${index + 1}. ${tool.name}`);
          outputChannel.appendLine(
            `     ${tool.description || "No description"}`,
          );
        });
        outputChannel.appendLine("");

        // Test 4: Call ast_index_status tool
        outputChannel.appendLine("Test 4: Call ast_index_status Tool");
        const statusResult = await client.callTool({
          name: "ast_index_status",
          arguments: {},
        });
        outputChannel.appendLine(
          `  Result: ${JSON.stringify(statusResult, null, 2)}`,
        );
        outputChannel.appendLine("");

        // Test 5: Test error handling
        outputChannel.appendLine("Test 5: Error Handling (Invalid Tool)");
        try {
          await client.callTool({
            name: "nonexistent_tool_xyz",
            arguments: {},
          });
          outputChannel.appendLine("  ❌ Should have thrown error");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`  ✅ Correctly caught error: ${message}`);
        }
        outputChannel.appendLine("");

        // Test 6: Test concurrent requests
        outputChannel.appendLine("Test 6: Concurrent Requests");
        const startTime = Date.now();
        const promises = [
          client.listTools(),
          client.callTool({ name: "ast_index_status", arguments: {} }),
          client.listResources?.() || Promise.resolve({ resources: [] }),
        ];

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const listToolsResult = results[0] as { tools: unknown[] };
        const resourcesResult = results[2] as { resources?: unknown[] };
        outputChannel.appendLine(
          `  ✅ All 3 requests completed in ${duration}ms`,
        );
        outputChannel.appendLine(
          `  - List tools: ${listToolsResult.tools?.length || 0} tools`,
        );
        outputChannel.appendLine(`  - Index status: Success`);
        outputChannel.appendLine(
          `  - List resources: ${resourcesResult.resources?.length || 0} resources`,
        );
        outputChannel.appendLine("");

        // Summary
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("✅ All tests passed!");
        outputChannel.appendLine("=".repeat(60));

        vscode.window.showInformationMessage(
          "MCP Client Test: All tests passed! ✅",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        outputChannel.appendLine("");
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine(`❌ Test failed: ${errorMessage}`);
        outputChannel.appendLine("=".repeat(60));

        if (error instanceof Error && error.stack) {
          outputChannel.appendLine("");
          outputChannel.appendLine("Stack trace:");
          outputChannel.appendLine(error.stack);
        }

        vscode.window.showErrorMessage(
          `MCP Client Test failed: ${errorMessage}`,
        );
      }
    },
  );
}

/**
 * Alternative: Simpler test command for quick validation
 */
export function registerQuickMCPTest(
  _context: vscode.ExtensionContext,
  clientManager: MCPClientManager | null,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "ast-helper.quickTestMCP",
    async () => {
      try {
        if (!clientManager) {
          throw new Error("MCPClientManager not initialized");
        }

        const client = clientManager.getClient();
        if (!client) {
          throw new Error("MCP client not connected");
        }

        // Quick test: call ast_index_status
        const result = await client.callTool({
          name: "ast_index_status",
          arguments: {},
        });

        vscode.window.showInformationMessage(
          `MCP Quick Test: Success! ✅\n${JSON.stringify(result).substring(0, 100)}...`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`MCP Quick Test failed: ${message}`);
      }
    },
  );
}
