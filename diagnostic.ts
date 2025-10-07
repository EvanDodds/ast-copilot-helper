// Simple diagnostic for our grammar manager parsing issue
import { TreeSitterGrammarManager } from "./packages/ast-helper/src/parser/grammar-manager.js";

async function simpleDiagnostic() {
  // eslint-disable-next-line no-console
  console.log("Testing TreeSitterGrammarManager parsing...");

  const grammarManager = new TreeSitterGrammarManager(".astdb-diagnostic");

  try {
    const parser = await grammarManager.loadParser("typescript");

    // eslint-disable-next-line no-console
    console.log("Parser loaded successfully");
    // eslint-disable-next-line no-console
    console.log("Parser type:", typeof parser);
    // eslint-disable-next-line no-console
    console.log("Parser constructor name:", parser?.constructor?.name);

    const code = "const x = 1;";
    // eslint-disable-next-line no-console
    console.log("Attempting to parse:", code);

    const tree = (parser as any).parse(code);
    // eslint-disable-next-line no-console
    console.log("Parse result:", tree);
    // eslint-disable-next-line no-console
    console.log("rootNode:", tree?.rootNode);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error:", error);
  }
}

simpleDiagnostic().catch(console.error);
