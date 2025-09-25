#!/usr/bin/env node
/**
 * Script to fetch real SHA256 hashes for Tree-sitter grammar WASM files
 * This replaces the mock hashes with actual verified hashes from the releases
 */

import { createHash } from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";

const GRAMMAR_URLS = {
  typescript:
    "https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.20.3/tree-sitter-typescript.wasm",
  javascript:
    "https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.20.1/tree-sitter-javascript.wasm",
  python:
    "https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.20.4/tree-sitter-python.wasm",
};

async function fetchGrammarHash(url: string): Promise<string> {
  console.log(`Fetching ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");

    console.log(`✅ Hash for ${url}: ${hash}`);
    return hash;
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error);
    throw error;
  }
}

async function main() {
  console.log("🔍 Fetching real SHA256 hashes for Tree-sitter grammars...\n");

  const hashes: Record<string, string> = {};

  for (const [language, url] of Object.entries(GRAMMAR_URLS)) {
    try {
      hashes[language] = await fetchGrammarHash(url);
    } catch (error) {
      console.error(`Failed to get hash for ${language}:`, error);
      process.exit(1);
    }
  }

  console.log("\n📝 Generated hashes:");
  console.log(JSON.stringify(hashes, null, 2));

  console.log("\n🔧 Update languages.ts with these values:");
  for (const [language, hash] of Object.entries(hashes)) {
    console.log(`    ${language}: '${hash}',`);
  }

  // Write to a file for easy copying
  const outputPath = resolve(process.cwd(), "grammar-hashes.json");
  writeFileSync(outputPath, JSON.stringify(hashes, null, 2));
  console.log(`\n💾 Hashes saved to: ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
