#!/usr/bin/env tsx
/**
 * Test script to validate binary build process
 * This helps debug issues in CI environments
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const projectRoot = process.cwd();

function runCommand(command: string, description: string): boolean {
  console.log(`\n🔍 ${description}`);
  console.log(`Command: ${command}`);

  try {
    const output = execSync(command, {
      encoding: "utf8",
      cwd: projectRoot,
      stdio: "pipe",
    });
    console.log(`✅ Success: ${description}`);
    if (output.trim()) {
      console.log(`Output: ${output.trim()}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    return false;
  }
}

function checkFile(filePath: string, description: string): boolean {
  const fullPath = join(projectRoot, filePath);
  const exists = existsSync(fullPath);

  if (exists) {
    console.log(`✅ ${description}: ${fullPath}`);
    return true;
  } else {
    console.log(`❌ Missing ${description}: ${fullPath}`);
    return false;
  }
}

async function main() {
  console.log("🧪 Binary Build Test Suite");
  console.log(`Working directory: ${projectRoot}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Architecture: ${process.arch}`);

  let failures = 0;

  // Test 1: Check Node.js SEA support
  console.log("\n📋 Test 1: Node.js SEA Support");
  if (!runCommand("node --help | grep experimental-sea", "Check SEA support")) {
    failures++;
  }

  // Test 2: Check postject availability
  console.log("\n📋 Test 2: Postject Availability");
  if (!runCommand("npx postject --help", "Check postject")) {
    console.log("⚠️ Postject not available, trying to install...");
    if (runCommand("npm install -g postject@latest", "Install postject")) {
      runCommand("npx postject --help", "Verify postject after install");
    } else {
      failures++;
    }
  }

  // Test 3: Check project build
  console.log("\n📋 Test 3: Project Build");
  if (!runCommand("yarn build", "Build project")) {
    failures++;
  }

  // Test 4: Check CLI module
  console.log("\n📋 Test 4: CLI Module");
  if (!checkFile("packages/ast-helper/dist/cli.js", "CLI module")) {
    failures++;
  }

  // Test 5: Test simple SEA creation
  console.log("\n📋 Test 5: Simple SEA Test");
  const testDir = "test-sea-simple";
  runCommand(`mkdir -p ${testDir}`, "Create test directory");

  // Create test files using proper cross-platform approach
  const testScript = 'console.log("Hello SEA");';
  const seaConfig = {
    main: "test.js",
    output: "test.blob",
    disableExperimentalSEAWarning: true,
  };

  try {
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");

    const testScriptPath = join(testDir, "test.js");
    const seaConfigPath = join(testDir, "sea-config.json");

    writeFileSync(testScriptPath, testScript, "utf8");
    writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2), "utf8");

    console.log("✅ Success: Create test script");
    console.log("✅ Success: Create SEA config");
  } catch (error) {
    console.error("❌ Failed: Create test files");
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    failures++;
  }

  if (
    runCommand(
      `cd ${testDir} && node --experimental-sea-config sea-config.json`,
      "Generate SEA blob",
    )
  ) {
    if (checkFile(`${testDir}/test.blob`, "SEA blob")) {
      console.log("✅ Basic SEA functionality works");
    } else {
      failures++;
    }
  } else {
    failures++;
  }

  runCommand(`rm -rf ${testDir}`, "Cleanup test directory");

  // Test 6: Binary build (for current platform)
  console.log(`\n📋 Test 6: Binary Build (${process.platform})`);
  const platform =
    process.platform === "win32"
      ? "win32"
      : process.platform === "darwin"
        ? "darwin"
        : "linux";

  if (runCommand(`yarn build:binary:${platform}`, `Build ${platform} binary`)) {
    const expectedExt = platform === "win32" ? ".exe" : "";
    const expectedBinary = `dist/binaries/ast-copilot-helper-${platform}-x64${expectedExt}`;

    if (checkFile(expectedBinary, `${platform} binary`)) {
      console.log("✅ Binary build successful");

      // Test binary execution
      const testBinaryCommand =
        process.platform === "win32"
          ? `"${expectedBinary}" --version`
          : `./${expectedBinary} --version`;

      runCommand(testBinaryCommand, "Test binary execution");
    } else {
      failures++;
    }
  } else {
    failures++;
  }

  // Summary
  console.log(`\n📊 Test Summary`);
  if (failures === 0) {
    console.log("🎉 All tests passed! Binary build should work in CI.");
  } else {
    console.log(`❌ ${failures} test(s) failed. Binary build may fail in CI.`);
    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Ensure Node.js version supports SEA (20.12.0+)");
    console.log("2. Install postject globally: npm install -g postject@latest");
    console.log("3. Build the project first: yarn build");
    console.log(
      "4. Check that the CLI module exists: packages/ast-helper/dist/cli.js",
    );
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(console.error);
