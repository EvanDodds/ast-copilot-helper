/**
 * Test the annotation engine signature extraction functionality
 */

import { AnnotationEngine } from "../packages/ast-helper/src/annotator/index.js";
import type { ASTNode } from "../packages/ast-helper/src/parser/types.js";

async function testSignatureExtraction() {
  const engine = new AnnotationEngine();

  // Test TypeScript function
  const tsNode: ASTNode = {
    id: "test-func",
    type: "function_declaration", 
    name: "calculateSum",
    startLine: 1,
    endLine: 5,
    startColumn: 0,
    endColumn: 20,
    filePath: "test.ts",
    language: "typescript",
    parentId: null,
    children: [],
    metadata: {
      modifiers: ["async", "export"],
      parameters: ["a: number", "b: number"],
      returnType: "Promise<number>"
    }
  };

  const sourceText = `export async function calculateSum(a: number, b: number): Promise<number> {
    return a + b;
  }`;

  try {
    console.log("Testing annotation generation...");
    const annotation = await engine.generateAnnotation(tsNode, sourceText, "test.ts");
    console.log("Generated annotation:", JSON.stringify(annotation, null, 2));
  } catch (error) {
    console.error("Error generating annotation:", error);
  }
}

testSignatureExtraction().catch(console.error);