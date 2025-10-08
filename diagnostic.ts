// Simple diagnostic for Rust parser functionality
import { createRustParserAdapter } from "./packages/ast-helper/dist/parser/rust-parser-adapter.js";

async function simpleDiagnostic() {
  // eslint-disable-next-line no-console
  console.log("Testing Rust parser functionality...");

  try {
    const parser = await createRustParserAdapter();

    // eslint-disable-next-line no-console
    console.log("Rust parser loaded successfully");
    // eslint-disable-next-line no-console
    console.log("Parser type:", typeof parser);
    // eslint-disable-next-line no-console
    console.log("Parser constructor name:", parser?.constructor?.name);

    const code = "const x = 1;";
    // eslint-disable-next-line no-console
    console.log("Attempting to parse:", code);

    const result = await parser.parseCode(code, "typescript");
    // eslint-disable-next-line no-console
    console.log(
      "Parse result:",
      result?.errors?.length === 0 ? "SUCCESS" : "FAILED",
    );
    // eslint-disable-next-line no-console
    console.log("AST nodes count:", result?.nodes?.length || 0);
    // eslint-disable-next-line no-console
    console.log("Root node type:", result?.nodes?.[0]?.type);
    // eslint-disable-next-line no-console
    console.log("Parse time:", result?.parseTime || 0, "ms");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error:", error);
  }
}

simpleDiagnostic().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Diagnostic failed:", error);
});
