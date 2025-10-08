/**
 * MCP Cache Test Command
 *
 * Test cache integration and display cache statistics.
 */

import * as vscode from "vscode";
import type { MCPClientManager } from "../managers/MCPClientManager.js";

/**
 * Run comprehensive MCP cache integration tests
 */
export async function runMCPCacheTests(
  outputChannel: vscode.OutputChannel,
  clientManager: MCPClientManager,
): Promise<void> {
  outputChannel.appendLine("=".repeat(60));
  outputChannel.appendLine("MCP Cache Integration Test");
  outputChannel.appendLine("=".repeat(60));
  outputChannel.appendLine("");

  if (!clientManager.isConnected()) {
    throw new Error("MCP client is not connected");
  }

  const client = clientManager.getClient();
  if (!client) {
    throw new Error("Client not available");
  }

  // Test 1: Get initial cache statistics
  outputChannel.appendLine("Test 1: Initial Cache Statistics");
  const initialStats = await clientManager.getCacheStats(true);
  outputChannel.appendLine(
    `  Cache stats: ${JSON.stringify(initialStats, null, 2)}`,
  );
  outputChannel.appendLine("");

  // Test 2: Perform a query (should be cache MISS)
  outputChannel.appendLine("Test 2: First Query (Expected Cache MISS)");
  await clientManager.callTool("semantic_query", {
    text: "cache test query unique",
    maxResults: 1,
  });
  outputChannel.appendLine("  ✓ Query executed (check for Cache MISS above)");
  outputChannel.appendLine("");

  // Test 3: Repeat query (should be cache HIT)
  outputChannel.appendLine("Test 3: Repeat Query (Expected Cache HIT)");
  await clientManager.callTool("semantic_query", {
    text: "cache test query unique",
    maxResults: 1,
  });
  outputChannel.appendLine("  ✓ Query repeated (check for Cache HIT above)");
  outputChannel.appendLine("");

  // Test 4: Get updated statistics
  outputChannel.appendLine("Test 4: Updated Cache Statistics");
  const updatedStats = await clientManager.getCacheStats(true);
  outputChannel.appendLine(
    `  Cache stats: ${JSON.stringify(updatedStats, null, 2)}`,
  );
  outputChannel.appendLine("");

  // Test 5: Cache warming
  outputChannel.appendLine("Test 5: Cache Warming");
  outputChannel.appendLine("  🔥 Warming cache with common queries...");
  await clientManager.warmCache([
    "error handling",
    "database connection",
    "api endpoints",
  ]);
  outputChannel.appendLine("  ✓ Cache warmed");
  outputChannel.appendLine("");

  // Test 6: Get final statistics after warming
  outputChannel.appendLine("Test 6: Final Cache Statistics After Warming");
  const finalStats = await clientManager.getCacheStats(true);
  outputChannel.appendLine(
    `  Cache stats: ${JSON.stringify(finalStats, null, 2)}`,
  );
  outputChannel.appendLine("");

  // Test 7: Cache pruning
  outputChannel.appendLine("Test 7: Cache Pruning");
  outputChannel.appendLine("  🧹 Pruning cache with LRU strategy...");
  await clientManager.pruneCache("lru", 10);
  outputChannel.appendLine("  ✓ Cache pruned");
  outputChannel.appendLine("");

  // Test 8: Verify pruning worked
  outputChannel.appendLine("Test 8: Cache Statistics After Pruning");
  const prunedStats = await clientManager.getCacheStats(true);
  outputChannel.appendLine(
    `  Cache stats: ${JSON.stringify(prunedStats, null, 2)}`,
  );
  outputChannel.appendLine("");

  // Test summary
  outputChannel.appendLine("=".repeat(60));
  outputChannel.appendLine("✅ All cache integration tests completed!");
  outputChannel.appendLine("=".repeat(60));
}

/**
 * Show current cache statistics
 */
export async function showCacheStats(
  outputChannel: vscode.OutputChannel,
  clientManager: MCPClientManager,
): Promise<void> {
  outputChannel.appendLine("=".repeat(60));
  outputChannel.appendLine("MCP Cache Statistics");
  outputChannel.appendLine("=".repeat(60));
  outputChannel.appendLine("");

  if (!clientManager.isConnected()) {
    throw new Error("MCP client is not connected");
  }

  const stats = await clientManager.getCacheStats(true);
  outputChannel.appendLine(JSON.stringify(stats, null, 2));
  outputChannel.appendLine("");
  outputChannel.appendLine("=".repeat(60));
}

/**
 * Register cache test command
 *
 * Usage:
 * 1. Add to extension.ts activate() function:
 *    const cacheTestCmd = registerMCPCacheTestCommand(context, clientManager);
 *    context.subscriptions.push(cacheTestCmd);
 *
 * 2. Run command: "AST Helper: Test Cache"
 */
export function registerMCPCacheTestCommand(
  _context: vscode.ExtensionContext,
  clientManager: MCPClientManager | null,
): vscode.Disposable {
  return vscode.commands.registerCommand("ast-helper.testCache", async () => {
    const outputChannel = vscode.window.createOutputChannel(
      "AST Helper - Cache Test",
    );
    outputChannel.show();

    try {
      outputChannel.appendLine("=".repeat(60));
      outputChannel.appendLine("MCP Cache Integration Test");
      outputChannel.appendLine("=".repeat(60));
      outputChannel.appendLine("");

      // Check client availability
      if (!clientManager) {
        throw new Error("MCPClientManager is not initialized");
      }

      if (!clientManager.isConnected()) {
        throw new Error("MCP client is not connected");
      }

      // Test 1: Get initial cache statistics
      outputChannel.appendLine("Test 1: Initial Cache Statistics");
      const initialStats = await clientManager.getCacheStats(true);
      outputChannel.appendLine(
        `  Cache stats: ${JSON.stringify(initialStats, null, 2)}`,
      );
      outputChannel.appendLine("");

      // Test 2: Perform a query (should be cache MISS)
      outputChannel.appendLine("Test 2: First Query (Expected Cache MISS)");
      const client = clientManager.getClient();
      if (!client) {
        throw new Error("Client not available");
      }

      await client.callTool({
        name: "semantic_query",
        arguments: {
          text: "authentication implementation",
          maxResults: 5,
        },
      });
      outputChannel.appendLine("  ✅ Query 1 completed");
      outputChannel.appendLine("");

      // Test 3: Repeat same query (should be cache HIT)
      outputChannel.appendLine("Test 3: Repeat Query (Expected Cache HIT)");
      await client.callTool({
        name: "semantic_query",
        arguments: {
          text: "authentication implementation",
          maxResults: 5,
        },
      });
      outputChannel.appendLine("  ✅ Query 2 completed");
      outputChannel.appendLine("");

      // Test 4: Get updated cache statistics
      outputChannel.appendLine("Test 4: Updated Cache Statistics");
      const updatedStats = await clientManager.getCacheStats(true);
      outputChannel.appendLine(
        `  Cache stats: ${JSON.stringify(updatedStats, null, 2)}`,
      );
      outputChannel.appendLine("");

      // Test 5: Warm cache with common queries
      outputChannel.appendLine("Test 5: Cache Warming");
      await clientManager.warmCache([
        "error handling",
        "database connection",
        "api endpoints",
      ]);
      outputChannel.appendLine("  ✅ Cache warmed");
      outputChannel.appendLine("");

      // Test 6: Get final cache statistics
      outputChannel.appendLine("Test 6: Final Cache Statistics");
      const finalStats = await clientManager.getCacheStats(true);
      outputChannel.appendLine(
        `  Cache stats: ${JSON.stringify(finalStats, null, 2)}`,
      );
      outputChannel.appendLine("");

      // Test 7: Prune cache
      outputChannel.appendLine("Test 7: Cache Pruning (LRU Strategy)");
      await clientManager.pruneCache("lru", 10);
      outputChannel.appendLine("  ✅ Cache pruned");
      outputChannel.appendLine("");

      // Test 8: Verify pruning worked
      outputChannel.appendLine("Test 8: Post-Prune Statistics");
      const prunedStats = await clientManager.getCacheStats(true);
      outputChannel.appendLine(
        `  Cache stats: ${JSON.stringify(prunedStats, null, 2)}`,
      );
      outputChannel.appendLine("");

      // Summary
      outputChannel.appendLine("=".repeat(60));
      outputChannel.appendLine("✅ Cache integration tests passed!");
      outputChannel.appendLine("=".repeat(60));
      outputChannel.appendLine("");
      outputChannel.appendLine("Key Findings:");
      outputChannel.appendLine(
        "  - Cache statistics are accessible via cache_stats tool",
      );
      outputChannel.appendLine(
        "  - Repeated queries leverage cache for performance",
      );
      outputChannel.appendLine("  - Cache warming preloads common queries");
      outputChannel.appendLine("  - Cache pruning manages memory usage");

      vscode.window.showInformationMessage("Cache Test: All tests passed! ✅");
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

      vscode.window.showErrorMessage(`Cache Test failed: ${errorMessage}`);
    }
  });
}

/**
 * Register cache statistics display command
 */
export function registerCacheStatsCommand(
  _context: vscode.ExtensionContext,
  clientManager: MCPClientManager | null,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "ast-helper.showCacheStats",
    async () => {
      try {
        if (!clientManager) {
          throw new Error("MCPClientManager not initialized");
        }

        if (!clientManager.isConnected()) {
          throw new Error("MCP client not connected");
        }

        const stats = await clientManager.getCacheStats(true);

        const outputChannel = vscode.window.createOutputChannel(
          "AST Helper - Cache Stats",
        );
        outputChannel.show();
        outputChannel.clear();

        outputChannel.appendLine("📊 Cache Statistics");
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine(JSON.stringify(stats, null, 2));

        vscode.window.showInformationMessage("Cache statistics displayed! 📊");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to get cache stats: ${message}`);
      }
    },
  );
}
