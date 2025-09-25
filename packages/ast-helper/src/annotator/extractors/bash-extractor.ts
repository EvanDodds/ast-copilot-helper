/**
 * Bash/Shell signature extractor
 * Handles shell script syntax including functions, variables,
 * and shell-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class BashExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function_definition":
      case "function":
        return this.extractFunctionSignature(sourceLines);

      case "variable_assignment":
      case "assignment":
        return this.extractVariableAssignment(sourceLines);

      case "command":
        return this.extractCommandSignature(sourceLines);

      default:
        return ExtractionUtils.cleanSignature(sourceLines.join(" "));
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    // Shell functions typically access parameters via $1, $2, etc.
    const paramUsageMatches = fullText.match(/\$[1-9]\d*/g);
    if (paramUsageMatches) {
      const uniqueParams = [...new Set(paramUsageMatches)].sort();
      return uniqueParams.map((param) => ({
        name: param,
        type: "string",
      }));
    }

    // Check for getopts or parameter parsing patterns
    const optMatch = fullText.match(
      /getopts\s+['":]([a-zA-Z:]+)['"][\s\S]*?(\w+)/,
    );
    if (optMatch) {
      const opts = optMatch[1] || "";
      return opts
        .split("")
        .filter((c) => c !== ":")
        .map((opt) => ({
          name: `-${opt}`,
          type: "option",
        }));
    }

    return [];
  }

  extractReturnType(_node: ASTNode, _sourceText: string): string | null {
    // Shell scripts typically return exit codes (numbers)
    return "exit_code";
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const modifiers: string[] = [];

    // Check for export modifier for variables
    if (fullText.includes("export")) {
      modifiers.push("export");
    }

    // Check for readonly modifier
    if (fullText.includes("readonly")) {
      modifiers.push("readonly");
    }

    // Check for local in functions
    if (fullText.includes("local")) {
      modifiers.push("local");
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match shell function definitions
    const funcMatch =
      fullText.match(/(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/) ||
      fullText.match(/(\w+)\s*\(\s*\)\s*\{/) ||
      fullText.match(/function\s+(\w+)\s*\{/);

    if (funcMatch) {
      return `function ${funcMatch[1]}()`;
    }

    return ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractVariableAssignment(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match variable assignments
    const varMatch =
      fullText.match(/(?:(?:export|readonly|local)\s+)?(\w+)\s*=\s*(.*)/) ||
      fullText.match(/(\w+)\[[^\]]+\]\s*=\s*(.*)/); // Array assignments

    if (varMatch) {
      const varName = varMatch[1] || "";
      const value = varMatch[2] || "";

      // Clean up the value part
      const cleanValue = value.replace(/\s*[;&]\s*$/, "").trim();

      return `${varName}=${cleanValue}`;
    }

    return ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractCommandSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Extract command with basic arguments (avoid complex pipeline parsing)
    const cmdMatch = fullText.match(/^(\w+(?:\s+[-\w]+)*)/);

    return cmdMatch
      ? cmdMatch[1]?.trim() || ""
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }
}
