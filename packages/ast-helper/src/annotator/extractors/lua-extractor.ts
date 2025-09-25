/**
 * Lua signature extractor
 * Handles Lua-specific syntax including functions, local functions,
 * and Lua-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class LuaExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_statement":
      case "local_function":
        return this.extractFunctionSignature(sourceLines);

      default:
        return ExtractionUtils.cleanSignature(sourceLines.join(" "));
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const paramMatch = fullText.match(/\(([^)]*)\)/);
    if (!paramMatch) {
      return [];
    }

    return this.parseLuaParameters(paramMatch[1] || "");
  }

  extractReturnType(_node: ASTNode, _sourceText: string): string | null {
    // Lua is dynamically typed, no explicit return types
    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const modifiers: string[] = [];

    if (fullText.includes("local")) {
      modifiers.push("local");
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Lua function signatures
    const funcMatch =
      fullText.match(/(?:local\s+)?function\s+[\w.:]*\w+\s*\([^)]*\)/) ||
      fullText.match(/(?:local\s+)?\w+\s*=\s*function\s*\([^)]*\)/);

    return funcMatch
      ? funcMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private parseLuaParameters(paramStr: string): Parameter[] {
    if (!paramStr.trim()) {
      return [];
    }

    return paramStr.split(",").map((param) => {
      const trimmed = param.trim();

      // Lua parameters are simple names or variadic (...)
      if (trimmed === "...") {
        return { name: "...", type: "vararg" };
      }

      const nameMatch = trimmed.match(/^(\w+)$/);
      if (nameMatch) {
        return { name: nameMatch[1] || "param", type: "any" };
      }

      return { name: trimmed || "param", type: "any" };
    });
  }
}
