/**
 * Ruby signature extractor
 * Handles Ruby-specific syntax including methods, classes, modules,
 * blocks, and Ruby-specific features like attr_accessor
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class RubyExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "method":
      case "method_declaration":
      case "function":
        return this.extractMethodSignature(sourceLines);

      case "class":
      case "class_declaration":
        return this.extractClassSignature(sourceLines);

      case "module":
      case "module_declaration":
        return this.extractModuleSignature(sourceLines);

      case "block":
      case "do_block":
      case "brace_block":
        return this.extractBlockSignature(sourceLines);

      case "attr":
      case "attr_accessor":
      case "attr_reader":
      case "attr_writer":
        return this.extractAttributeSignature(sourceLines);

      case "constant":
      case "constant_assignment":
        return this.extractConstantSignature(sourceLines);

      case "alias":
      case "alias_method":
        return this.extractAliasSignature(sourceLines);

      default:
        return sourceLines.length > 0 ? sourceLines[0]?.trim() || "" : "";
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Find method definition
    const methodLine = sourceLines.find(
      (line) =>
        line.includes("def ") &&
        (line.includes("(") || line.match(/def\s+\w+\s*$/)),
    );

    if (!methodLine) {
      return [];
    }

    return this.parseRubyParameters(methodLine);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    // Ruby is dynamically typed, but we can look for type comments or yard docs
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Look for YARD documentation @return
    for (const line of sourceLines) {
      const yardMatch = line.match(/@return\s+\[([^\]]+)\]/);
      if (yardMatch) {
        return yardMatch[1]?.trim() ?? null;
      }

      // Look for Sorbet type annotations
      const sorbetMatch = line.match(/T\.returns\(([^)]+)\)/);
      if (sorbetMatch) {
        return sorbetMatch[1]?.trim() ?? null;
      }
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const modifiers: string[] = [];

    // Look for access modifiers in previous lines or same line
    const fullText = sourceLines.join("\n");

    if (fullText.includes("private")) {
      modifiers.push("private");
    }
    if (fullText.includes("protected")) {
      modifiers.push("protected");
    }
    if (fullText.includes("public")) {
      modifiers.push("public");
    }

    // Ruby-specific modifiers
    for (const line of sourceLines) {
      if (line.includes("class << self")) {
        modifiers.push("class");
      }
      if (line.includes("self.")) {
        modifiers.push("self");
      }
      if (line.includes("module_function")) {
        modifiers.push("module_function");
      }
    }

    return modifiers;
  }

  private extractMethodSignature(sourceLines: string[]): string {
    // Find method definition
    const methodLine = sourceLines.find((line) =>
      line.trim().startsWith("def "),
    );

    if (!methodLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Ruby method signatures are typically on one line
    const signature = methodLine.trim();

    // Remove any inline comments
    return signature.replace(/\s*#.*$/, "").trim();
  }

  private extractClassSignature(sourceLines: string[]): string {
    const classLine = sourceLines.find((line) => line.includes("class "));

    if (!classLine) {
      return sourceLines[0]?.trim() || "";
    }

    return classLine.trim().replace(/\s*#.*$/, "");
  }

  private extractModuleSignature(sourceLines: string[]): string {
    const moduleLine = sourceLines.find((line) => line.includes("module "));

    if (!moduleLine) {
      return sourceLines[0]?.trim() || "";
    }

    return moduleLine.trim().replace(/\s*#.*$/, "");
  }

  private extractBlockSignature(sourceLines: string[]): string {
    // Find block start
    const blockLine = sourceLines.find(
      (line) => line.includes("do ") || line.includes("{ "),
    );

    if (!blockLine) {
      return sourceLines[0]?.trim() || "";
    }

    return blockLine.trim().replace(/\s*#.*$/, "");
  }

  private extractAttributeSignature(sourceLines: string[]): string {
    const attrLine = sourceLines.find(
      (line) => line.includes("attr_") || line.includes("attr "),
    );

    if (!attrLine) {
      return sourceLines[0]?.trim() || "";
    }

    return attrLine.trim().replace(/\s*#.*$/, "");
  }

  private extractConstantSignature(sourceLines: string[]): string {
    // Find constant assignment (uppercase identifier)
    const constLine = sourceLines.find((line) =>
      line.match(/^\s*[A-Z][A-Z_0-9]*\s*=/),
    );

    if (!constLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Show just the assignment, not the value
    return constLine.replace(/=.*$/, "=").trim();
  }

  private extractAliasSignature(sourceLines: string[]): string {
    const aliasLine = sourceLines.find(
      (line) => line.includes("alias ") || line.includes("alias_method"),
    );

    if (!aliasLine) {
      return sourceLines[0]?.trim() || "";
    }

    return aliasLine.trim().replace(/\s*#.*$/, "");
  }

  private parseRubyParameters(methodLine: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract parameter list from method definition
    const methodMatch = methodLine.match(
      /def\s+(?:\w+\.)?(\w+)(?:\(([^)]*)\))?/,
    );
    if (!methodMatch) {
      return parameters;
    }

    const paramStr = methodMatch[2];
    if (!paramStr?.trim()) {
      return parameters;
    }

    // Split parameters by comma
    const parts = this.splitRubyParameters(paramStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const param = this.parseRubyParameter(trimmed);
      if (param) {
        parameters.push(param);
      }
    }

    return parameters;
  }

  private splitRubyParameters(paramStr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];

      if (char === "(" || char === "[" || char === "{") {
        depth++;
      } else if (char === ")" || char === "]" || char === "}") {
        depth--;
      } else if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }

      if (char) {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }

  private parseRubyParameter(paramStr: string): Parameter | null {
    const trimmed = paramStr.trim();

    // Ruby parameter patterns:
    // name (required)
    // name = default (optional with default)
    // *name (splat)
    // **name (double splat/keyword args)
    // &name (block parameter)
    // name: (keyword parameter)
    // name: default (keyword with default)

    // Block parameter
    if (trimmed.startsWith("&")) {
      return {
        name: trimmed.substring(1),
        type: "block",
        optional: true,
      };
    }

    // Double splat (keyword args)
    if (trimmed.startsWith("**")) {
      return {
        name: trimmed.substring(2),
        type: "keyword_args",
        optional: true,
      };
    }

    // Splat parameter
    if (trimmed.startsWith("*")) {
      return {
        name: trimmed.substring(1),
        type: "array",
        optional: true,
      };
    }

    // Keyword parameter with default
    const keywordDefaultMatch = trimmed.match(/^(\w+):\s*(.+)$/);
    if (keywordDefaultMatch) {
      return {
        name: keywordDefaultMatch[1] || "",
        type: "keyword",
        optional: true,
      };
    }

    // Keyword parameter
    const keywordMatch = trimmed.match(/^(\w+):$/);
    if (keywordMatch) {
      return {
        name: keywordMatch[1] || "",
        type: "keyword",
        optional: false,
      };
    }

    // Regular parameter with default
    const defaultMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (defaultMatch) {
      return {
        name: defaultMatch[1] || "",
        type: "any",
        optional: true,
      };
    }

    // Regular parameter
    const regularMatch = trimmed.match(/^(\w+)$/);
    if (regularMatch) {
      return {
        name: regularMatch[1] || "",
        type: "any",
        optional: false,
      };
    }

    return null;
  }
}
