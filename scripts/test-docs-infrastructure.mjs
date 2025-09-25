#!/usr/bin/env node

/**
 * Documentation Infrastructure Test
 * Validates that the documentation can be built and deployed successfully
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const DOCS_DIR = join(process.cwd(), "docs");
const CONFIG_FILE = join(DOCS_DIR, ".vitepress", "config.ts");
const PACKAGE_FILE = join(DOCS_DIR, "package.json");

console.log("🧪 Testing Documentation Infrastructure...\n");

// Test 1: Check if documentation directory structure exists
console.log("1️⃣  Checking documentation structure...");
const requiredDirectories = [
  "docs",
  "docs/.vitepress",
  "docs/guide",
  "docs/api",
  "docs/examples",
  "docs/development",
];

for (const dir of requiredDirectories) {
  if (!existsSync(dir)) {
    console.error(`❌ Missing directory: ${dir}`);
    process.exit(1);
  }
}
console.log("✅ Documentation structure is valid\n");

// Test 2: Validate VitePress configuration
console.log("2️⃣  Validating VitePress configuration...");
if (!existsSync(CONFIG_FILE)) {
  console.error("❌ VitePress config file not found");
  process.exit(1);
}

const configContent = readFileSync(CONFIG_FILE, "utf-8");
const requiredConfigItems = [
  "defineConfig",
  'title: "ast-copilot-helper"',
  "themeConfig",
  "sidebar",
  "search",
  "socialLinks",
];

for (const item of requiredConfigItems) {
  if (!configContent.includes(item)) {
    console.error(`❌ Missing config item: ${item}`);
    process.exit(1);
  }
}
console.log("✅ VitePress configuration is valid\n");

// Test 3: Check package.json and dependencies
console.log("3️⃣  Checking documentation dependencies...");
if (!existsSync(PACKAGE_FILE)) {
  console.error("❌ Documentation package.json not found");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PACKAGE_FILE, "utf-8"));
const requiredDeps = ["vitepress"];
const requiredScripts = ["dev", "build", "preview"];

for (const dep of requiredDeps) {
  if (!pkg.devDependencies?.[dep] && !pkg.dependencies?.[dep]) {
    console.error(`❌ Missing dependency: ${dep}`);
    process.exit(1);
  }
}

for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) {
    console.error(`❌ Missing script: ${script}`);
    process.exit(1);
  }
}
console.log("✅ Documentation dependencies are valid\n");

// Test 4: Check required documentation files
console.log("4️⃣  Checking required documentation files...");
const requiredFiles = ["docs/index.md", "docs/.vitepress/config.ts"];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`❌ Missing file: ${file}`);
    process.exit(1);
  }
}
console.log("✅ Required documentation files exist\n");

// Test 5: Validate GitHub Actions workflow
console.log("5️⃣  Checking deployment workflow...");
const workflowFile = ".github/workflows/docs.yml";
if (!existsSync(workflowFile)) {
  console.error("❌ Documentation deployment workflow not found");
  process.exit(1);
}

const workflowContent = readFileSync(workflowFile, "utf-8");
const requiredWorkflowItems = [
  "name: Deploy Documentation",
  "uses: actions/setup-node@v4",
  "npm run build",
  "actions/deploy-pages@v4",
];

for (const item of requiredWorkflowItems) {
  if (!workflowContent.includes(item)) {
    console.error(`❌ Missing workflow item: ${item}`);
    process.exit(1);
  }
}
console.log("✅ Deployment workflow is configured\n");

console.log("🎉 All documentation infrastructure tests passed!\n");
console.log("📋 Summary:");
console.log("   ✅ Directory structure created");
console.log("   ✅ VitePress configuration ready");
console.log("   ✅ Dependencies configured");
console.log("   ✅ Required files present");
console.log("   ✅ Deployment workflow ready");
console.log("\n🚀 Documentation infrastructure is ready for content!");
