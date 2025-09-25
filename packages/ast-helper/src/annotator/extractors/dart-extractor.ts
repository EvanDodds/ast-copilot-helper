/**
 * Dart signature extractor
 * Handles Dart-specific syntax including classes, functions,
 * libraries, and Dart-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class DartExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_declaration":
      case "method":
        return this.extractFunctionSignature(sourceLines);

      case "class":
      case "class_definition":
        return this.extractClassSignature(sourceLines);

      case "library":
      case "library_name":
        return this.extractLibrarySignature(sourceLines);

      case "enum":
      case "enum_declaration":
        return this.extractEnumSignature(sourceLines);

      case "mixin":
      case "mixin_declaration":
        return this.extractMixinSignature(sourceLines);

      case "extension":
      case "extension_declaration":
        return this.extractExtensionSignature(sourceLines);

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

    return this.parseDartParameters(paramMatch[1] || "");
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    // Match Dart return type syntax: Type functionName() or functionName(): Type
    const returnMatch =
      fullText.match(/(?:^|\s)([\w<>]+)\s+\w+\s*\(/) ||
      fullText.match(/\)\s*:\s*([\w<>]+)/);
    if (returnMatch) {
      return returnMatch[1]?.trim() || null;
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const modifiers: string[] = [];

    // Dart access modifiers and keywords
    if (fullText.includes("static")) {
      modifiers.push("static");
    }
    if (fullText.includes("final")) {
      modifiers.push("final");
    }
    if (fullText.includes("const")) {
      modifiers.push("const");
    }
    if (fullText.includes("abstract")) {
      modifiers.push("abstract");
    }
    if (fullText.includes("async")) {
      modifiers.push("async");
    }
    if (fullText.includes("external")) {
      modifiers.push("external");
    }
    if (fullText.includes("factory")) {
      modifiers.push("factory");
    }
    if (fullText.includes("override")) {
      modifiers.push("override");
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const funcMatch = fullText.match(
      /(?:static\s+|final\s+|abstract\s+|external\s+)?(?:async\s+)?(?:\w+\s+)?\w+\s*\([^{]*/,
    );
    return funcMatch
      ? funcMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractClassSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const classMatch = fullText.match(
      /(?:abstract\s+)?class\s+\w+(?:\s+extends\s+\w+)?(?:\s+with\s+\w+(?:,\s*\w+)*)?(?:\s+implements\s+\w+(?:,\s*\w+)*)?/,
    );
    return classMatch
      ? classMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractLibrarySignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const libMatch = fullText.match(/library\s+[\w.]+/);
    return libMatch
      ? libMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractEnumSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const enumMatch = fullText.match(/enum\s+\w+/);
    return enumMatch
      ? enumMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractMixinSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const mixinMatch = fullText.match(
      /mixin\s+\w+(?:\s+on\s+\w+(?:,\s*\w+)*)?/,
    );
    return mixinMatch
      ? mixinMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractExtensionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");
    const extensionMatch = fullText.match(/extension\s+(?:\w+\s+)?on\s+\w+/);
    return extensionMatch
      ? extensionMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private parseDartParameters(paramStr: string): Parameter[] {
    if (!paramStr.trim()) {
      return [];
    }

    return paramStr.split(",").map((param) => {
      const trimmed = param.trim();

      // Handle typed parameters: Type name or name: Type
      const typedMatch =
        trimmed.match(/^(\w+)\s+(\w+)$/) ||
        trimmed.match(/^(\w+)\s*:\s*(\w+)$/);
      if (typedMatch) {
        const [, first, second] = typedMatch;
        return { name: second || first || "param", type: first || "dynamic" };
      }

      // Handle simple parameters
      const simpleMatch = trimmed.match(/^(\w+)$/);
      if (simpleMatch) {
        return { name: simpleMatch[1] || "param", type: "dynamic" };
      }

      return { name: trimmed || "param", type: "dynamic" };
    });
  }
}
