/**
 * Scala signature extractor
 * Handles Scala-specific syntax including objects, classes, traits,
 * functions, and Scala-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class ScalaExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_definition":
      case "method":
        return this.extractFunctionSignature(sourceLines);

      case "class":
      case "class_definition":
        return this.extractClassSignature(sourceLines);

      case "object":
      case "object_definition":
        return this.extractObjectSignature(sourceLines);

      case "trait":
      case "trait_definition":
        return this.extractTraitSignature(sourceLines);

      case "case_class":
      case "case_class_definition":
        return this.extractCaseClassSignature(sourceLines);

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

    return this.parseScalaParameters(paramMatch[1] || "");
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    // Match Scala return type syntax: def name(): Type or def name: Type
    const returnMatch =
      fullText.match(/:\s*([\w[\]]+)(?:\s*=|$)/) ||
      fullText.match(/\)\s*:\s*([\w[\]]+)/);
    if (returnMatch) {
      return returnMatch[1]?.trim() || null;
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const modifiers: string[] = [];

    // Scala access modifiers and keywords
    if (fullText.includes("private")) {
      modifiers.push("private");
    }
    if (fullText.includes("protected")) {
      modifiers.push("protected");
    }
    if (fullText.includes("implicit")) {
      modifiers.push("implicit");
    }
    if (fullText.includes("sealed")) {
      modifiers.push("sealed");
    }
    if (fullText.includes("final")) {
      modifiers.push("final");
    }
    if (fullText.includes("abstract")) {
      modifiers.push("abstract");
    }
    if (fullText.includes("override")) {
      modifiers.push("override");
    }
    if (fullText.includes("lazy")) {
      modifiers.push("lazy");
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const funcMatch = fullText.match(
      /(?:private\s+|protected\s+|implicit\s+|override\s+|final\s+)*def\s+\w+[^{=]*/,
    );
    return funcMatch
      ? funcMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractClassSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const classMatch = fullText.match(
      /(?:sealed\s+|abstract\s+|final\s+)?class\s+\w+(?:\([^)]*\))?(?:\s+extends\s+\w+)?(?:\s+with\s+\w+(?:\s+with\s+\w+)*)?/,
    );
    return classMatch
      ? classMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractObjectSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const objectMatch = fullText.match(
      /object\s+\w+(?:\s+extends\s+\w+)?(?:\s+with\s+\w+(?:\s+with\s+\w+)*)?/,
    );
    return objectMatch
      ? objectMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractTraitSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const traitMatch = fullText.match(
      /(?:sealed\s+)?trait\s+\w+(?:\s+extends\s+\w+)?(?:\s+with\s+\w+(?:\s+with\s+\w+)*)?/,
    );
    return traitMatch
      ? traitMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractCaseClassSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const caseClassMatch = fullText.match(
      /case\s+class\s+\w+(?:\([^)]*\))?(?:\s+extends\s+\w+)?(?:\s+with\s+\w+(?:\s+with\s+\w+)*)?/,
    );
    return caseClassMatch
      ? caseClassMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private parseScalaParameters(paramStr: string): Parameter[] {
    if (!paramStr.trim()) {
      return [];
    }

    return paramStr.split(",").map((param) => {
      const trimmed = param.trim();

      // Handle Scala parameters: name: Type or implicit name: Type
      const paramMatch = trimmed.match(
        /(?:implicit\s+)?(\w+)\s*:\s*([\w[\]]+)/,
      );
      if (paramMatch) {
        const [, name, type] = paramMatch;
        return { name: name || "param", type: type || "Any" };
      }

      return { name: trimmed || "param", type: "Any" };
    });
  }
}
