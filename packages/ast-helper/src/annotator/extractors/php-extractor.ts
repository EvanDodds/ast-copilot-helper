/**
 * PHP signature extractor
 * Handles PHP-specific syntax including functions, classes, interfaces,
 * traits, namespaces, and modern PHP features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class PhpExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_definition":
      case "function_declaration":
      case "method":
      case "method_declaration":
        return this.extractFunctionSignature(sourceLines);

      case "class":
      case "class_declaration":
        return this.extractClassSignature(sourceLines);

      case "interface":
      case "interface_declaration":
        return this.extractInterfaceSignature(sourceLines);

      case "trait":
      case "trait_declaration":
        return this.extractTraitSignature(sourceLines);

      case "namespace":
      case "namespace_definition":
        return this.extractNamespaceSignature(sourceLines);

      case "property":
      case "property_declaration":
        return this.extractPropertySignature(sourceLines);

      case "const":
      case "const_declaration":
        return this.extractConstantSignature(sourceLines);

      case "use":
      case "use_declaration":
        return this.extractUseSignature(sourceLines);

      default:
        return sourceLines.length > 0 ? sourceLines[0]?.trim() || "" : "";
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Find function/method declaration
    const functionLine = sourceLines.find(
      (line) => line.includes("function ") && line.includes("("),
    );

    if (!functionLine) {
      return [];
    }

    return this.parsePhpParameters(functionLine, sourceLines);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Look for return type after :
    const returnTypeLine = sourceLines.find((line) => line.includes(":"));
    if (!returnTypeLine) {
      return null;
    }

    const returnMatch = returnTypeLine.match(/:\s*([^{;]+)/);
    return returnMatch ? (returnMatch[1]?.trim() ?? null) : null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const modifiers: string[] = [];

    for (const line of sourceLines) {
      if (line.includes("public")) {
        modifiers.push("public");
      }
      if (line.includes("private")) {
        modifiers.push("private");
      }
      if (line.includes("protected")) {
        modifiers.push("protected");
      }
      if (line.includes("static")) {
        modifiers.push("static");
      }
      if (line.includes("final")) {
        modifiers.push("final");
      }
      if (line.includes("abstract")) {
        modifiers.push("abstract");
      }
      if (line.includes("readonly")) {
        modifiers.push("readonly");
      }
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    // Find function/method declaration
    const functionLine = sourceLines.find((line) => line.includes("function "));

    if (!functionLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract function signature, potentially spanning multiple lines
    let signature = functionLine.trim();

    // If the line doesn't end with { or ;, it might continue on next lines
    if (!functionLine.includes("{") && !functionLine.includes(";")) {
      const startIndex = sourceLines.indexOf(functionLine);
      for (let i = startIndex + 1; i < sourceLines.length; i++) {
        signature += " " + sourceLines[i]?.trim();
        if (sourceLines[i]?.includes("{") || sourceLines[i]?.includes(";")) {
          break;
        }
      }
    }

    // Clean up the signature
    return signature.replace(/\s*\{.*$/, "").trim();
  }

  private extractClassSignature(sourceLines: string[]): string {
    const classLine = sourceLines.find((line) => line.includes("class "));

    if (!classLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract class name, extends, implements
    return classLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractInterfaceSignature(sourceLines: string[]): string {
    const interfaceLine = sourceLines.find((line) =>
      line.includes("interface "),
    );

    if (!interfaceLine) {
      return sourceLines[0]?.trim() || "";
    }

    return interfaceLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractTraitSignature(sourceLines: string[]): string {
    const traitLine = sourceLines.find((line) => line.includes("trait "));

    if (!traitLine) {
      return sourceLines[0]?.trim() || "";
    }

    return traitLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractNamespaceSignature(sourceLines: string[]): string {
    const namespaceLine = sourceLines.find((line) =>
      line.includes("namespace "),
    );

    if (!namespaceLine) {
      return sourceLines[0]?.trim() || "";
    }

    return namespaceLine.replace(/\s*[{;].*$/, "").trim();
  }

  private extractPropertySignature(sourceLines: string[]): string {
    // Find property declaration
    const propertyLine = sourceLines.find(
      (line) =>
        line.includes("$") ||
        line.match(/(public|private|protected|static|readonly)/),
    );

    if (!propertyLine) {
      return sourceLines[0]?.trim() || "";
    }

    return propertyLine.replace(/\s*[=;].*$/, "").trim();
  }

  private extractConstantSignature(sourceLines: string[]): string {
    const constLine = sourceLines.find((line) => line.includes("const "));

    if (!constLine) {
      return sourceLines[0]?.trim() || "";
    }

    return constLine.replace(/\s*=.*$/, "").trim();
  }

  private extractUseSignature(sourceLines: string[]): string {
    const useLine = sourceLines.find((line) => line.includes("use "));

    if (!useLine) {
      return sourceLines[0]?.trim() || "";
    }

    return useLine.replace(/\s*;.*$/, "").trim();
  }

  private parsePhpParameters(
    functionLine: string,
    sourceLines: string[],
  ): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract full parameter list, potentially spanning multiple lines
    let fullParamString = functionLine;

    if (!functionLine.includes(")")) {
      const paramStart = sourceLines.indexOf(functionLine);
      for (let i = paramStart + 1; i < sourceLines.length; i++) {
        fullParamString += " " + sourceLines[i]?.trim();
        if (sourceLines[i]?.includes(")")) {
          break;
        }
      }
    }

    // Extract parameter list from parentheses
    const paramMatch = fullParamString.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]?.trim()) {
      return parameters;
    }

    const paramStr = paramMatch[1].trim();

    // Split parameters by comma
    const parts = this.splitPhpParameters(paramStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const param = this.parsePhpParameter(trimmed);
      if (param) {
        parameters.push(param);
      }
    }

    return parameters;
  }

  private splitPhpParameters(paramStr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];

      if (char === "(" || char === "[") {
        depth++;
      } else if (char === ")" || char === "]") {
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

  private parsePhpParameter(paramStr: string): Parameter | null {
    const trimmed = paramStr.trim();

    // Match PHP parameter patterns:
    // ?Type $name = default
    // Type $name
    // $name = default
    // &$name (reference)
    // ...$name (variadic)
    const patterns = [
      // ?Type $name = default
      /^(\??\w+(?:\|\w+)*)\s+(&?\.\.\.)?\$(\w+)(?:\s*=\s*.+)?$/,
      // $name = default (no type)
      /^(&?\.\.\.)?\$(\w+)(?:\s*=\s*.+)?$/,
      // Type only (constructor promotion, etc.)
      /^(\??\w+(?:\|\w+)*)\s*$/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        let type = "";
        let name = "";

        if (pattern.source.includes("\\$")) {
          // Pattern with variable name
          if (match[1] && match[3]) {
            // Type and name
            type = match[1];
            name = match[3];
          } else if (match[2]) {
            // Just name (no type)
            name = match[2];
            type = "mixed";
          }
        } else {
          // Just type
          type = match[1] || "mixed";
          name = "unnamed";
        }

        if (name || type) {
          return {
            name: name || "unnamed",
            type: type || "mixed",
            optional: trimmed.includes("=") || trimmed.includes("?"),
          };
        }
      }
    }

    return null;
  }
}
