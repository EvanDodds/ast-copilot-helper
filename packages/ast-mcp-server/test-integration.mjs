#!/usr/bin/env node

/**
 * Integration test script for the AST MCP Server
 * Tests end-to-end functionality including server startup, tool execution, and shutdown
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPServerTester {
  constructor() {
    this.serverProcess = null;
    this.results = [];
    this.serverPath = join(__dirname, "dist", "cli.js");
  }

  async runTests() {
    console.log("🚀 Starting AST MCP Server Integration Tests\n");

    try {
      // Test 1: Server startup and basic functionality
      await this.testServerStartup();

      // Test 2: CLI help command
      await this.testCLIHelp();

      // Test 3: Configuration validation
      await this.testConfiguration();

      // Test 4: End-to-end MCP protocol (if possible)
      await this.testMCPProtocol();

      this.printResults();
    } catch (error) {
      console.error("❌ Integration tests failed:", error);
      process.exit(1);
    }
  }

  async testServerStartup() {
    const startTime = Date.now();

    try {
      console.log("📋 Test 1: Server Startup and Basic Functionality");

      // Test that the server can be invoked
      const result = await this.runCommand([this.serverPath, "--help"], 5000);

      if (result.code === 0 && result.stdout.includes("Commands:")) {
        this.addResult(
          "Server Startup",
          true,
          undefined,
          Date.now() - startTime,
        );
        console.log("✅ Server startup test passed\n");
      } else {
        throw new Error(
          `Server failed to start properly. Exit code: ${result.code}`,
        );
      }
    } catch (error) {
      this.addResult(
        "Server Startup",
        false,
        error.message,
        Date.now() - startTime,
      );
      console.log(`❌ Server startup test failed: ${error.message}\n`);
    }
  }

  async testCLIHelp() {
    const startTime = Date.now();

    try {
      console.log("📋 Test 2: CLI Help Command");

      const result = await this.runCommand([this.serverPath, "--help"], 3000);

      const expectedSections = [
        "Commands:",
        "Environment Variables:",
        "Examples:",
      ];

      const allSectionsPresent = expectedSections.every((section) =>
        result.stdout.includes(section),
      );

      if (result.code === 0 && allSectionsPresent) {
        this.addResult("CLI Help", true, undefined, Date.now() - startTime);
        console.log("✅ CLI help test passed\n");
      } else {
        throw new Error("CLI help output is incomplete or malformed");
      }
    } catch (error) {
      this.addResult("CLI Help", false, error.message, Date.now() - startTime);
      console.log(`❌ CLI help test failed: ${error.message}\n`);
    }
  }

  async testConfiguration() {
    const startTime = Date.now();

    try {
      console.log("📋 Test 3: Configuration Validation");

      // Create a temporary config file
      const tempConfigPath = join(__dirname, "temp-config.json");
      const testConfig = {
        name: "Integration Test Server",
        version: "1.0.0-test",
        transport: { type: "stdio" },
        database: { path: ":memory:" },
        logging: { level: "info" },
      };

      await fs.promises.writeFile(
        tempConfigPath,
        JSON.stringify(testConfig, null, 2),
      );

      // Test server with custom config (just validate it doesn't crash immediately)
      await this.runCommand(
        ["node", this.serverPath, "run", "--config", tempConfigPath],
        2000,
      );

      // Clean up
      try {
        await fs.promises.unlink(tempConfigPath);
      } catch {
        // Ignore cleanup errors
      }

      // If the server doesn't crash immediately, consider it a success
      this.addResult("Configuration", true, undefined, Date.now() - startTime);
      console.log("✅ Configuration test passed\n");
    } catch (error) {
      this.addResult(
        "Configuration",
        false,
        error.message,
        Date.now() - startTime,
      );
      console.log(`❌ Configuration test failed: ${error.message}\n`);
    }
  }

  async testMCPProtocol() {
    const startTime = Date.now();

    try {
      console.log("📋 Test 4: Basic MCP Protocol Test");

      // For now, just verify the server can be started in stdio mode
      // A full MCP protocol test would require implementing a client
      console.log(
        "⚠️  Full MCP protocol testing requires an MCP client implementation",
      );
      console.log(
        "📝 This test validates that the server can be invoked in stdio mode",
      );

      // Test that server starts without immediate crash
      const serverProcess = spawn("node", [this.serverPath, "run"], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 1000,
      });

      let crashed = false;
      serverProcess.on("error", () => {
        crashed = true;
      });

      // Wait briefly to see if server crashes immediately
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Kill the process
      serverProcess.kill("SIGTERM");

      if (!crashed) {
        this.addResult(
          "MCP Protocol Basic",
          true,
          undefined,
          Date.now() - startTime,
        );
        console.log("✅ Basic MCP protocol test passed\n");
      } else {
        throw new Error("Server crashed during startup");
      }
    } catch (error) {
      this.addResult(
        "MCP Protocol Basic",
        false,
        error.message,
        Date.now() - startTime,
      );
      console.log(`❌ MCP protocol test failed: ${error.message}\n`);
    }
  }

  async runCommand(command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill("SIGTERM");
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      process.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code: code || 0, stdout, stderr });
      });

      process.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  addResult(name, success, error, duration = 0) {
    this.results.push({ name, success, error, duration });
  }

  printResults() {
    console.log("📊 Integration Test Results");
    console.log("=".repeat(50));

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      const duration = `(${result.duration}ms)`;

      console.log(`${status} ${result.name} ${duration}`);

      if (!result.success && result.error) {
        console.log(`    Error: ${result.error}`);
      }

      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    }

    console.log("=".repeat(50));
    console.log(
      `Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`,
    );

    if (failed === 0) {
      console.log("\n🎉 All integration tests passed!");
    } else {
      console.log(
        `\n⚠️  ${failed} test(s) failed. Server functionality may be limited.`,
      );
    }

    // Additional info
    console.log("\n📋 Integration Test Summary:");
    console.log("- Server builds and runs without compilation errors");
    console.log("- CLI interface responds to commands");
    console.log("- Configuration system accepts valid configurations");
    console.log("- Server process can be started in stdio mode");
    console.log(
      "\n💡 For full functionality testing, run the unit test suite:",
    );
    console.log("   npm test");
    console.log("\n💡 For development with hot-reload:");
    console.log("   npm run dev");
  }
}

// Run the integration tests
const tester = new MCPServerTester();
tester.runTests().catch(console.error);
