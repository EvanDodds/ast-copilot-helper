/**
 * Swift signature extractor
 * Handles Swift-specific syntax including classes, structs, protocols,
 * functions, properties, and Swift-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class SwiftExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_declaration":
      case "method":
        return this.extractFunctionSignature(sourceLines);

      case "class":
      case "class_declaration":
        return this.extractClassSignature(sourceLines);

      case "struct":
      case "struct_declaration":
        return this.extractStructSignature(sourceLines);

      case "protocol":
      case "protocol_declaration":
        return this.extractProtocolSignature(sourceLines);

      case "enum":
      case "enum_declaration":
        return this.extractEnumSignature(sourceLines);

      case "property":
      case "property_declaration":
        return this.extractPropertySignature(sourceLines);

      case "init":
      case "init_declaration":
      case "initializer":
        return this.extractInitializerSignature(sourceLines);

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

    // Match Swift function parameters
    const paramMatch = fullText.match(/\(([^)]*)\)/);
    if (!paramMatch) {
      return [];
    }

    return this.parseSwiftParameters(paramMatch[1] || "");
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    // Match Swift return type syntax: -> Type
    const returnMatch = fullText.match(/->\s*([^{]+)/);
    if (returnMatch) {
      return returnMatch[1]?.trim() || null;
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const fullText = sourceLines.join(" ");

    const modifiers: string[] = [];

    // Swift access modifiers
    if (fullText.includes("public")) {
      modifiers.push("public");
    }
    if (fullText.includes("private")) {
      modifiers.push("private");
    }
    if (fullText.includes("internal")) {
      modifiers.push("internal");
    }
    if (fullText.includes("fileprivate")) {
      modifiers.push("fileprivate");
    }
    if (fullText.includes("open")) {
      modifiers.push("open");
    }

    // Swift other modifiers
    if (fullText.includes("static")) {
      modifiers.push("static");
    }
    if (fullText.includes("class")) {
      modifiers.push("class");
    }
    if (fullText.includes("final")) {
      modifiers.push("final");
    }
    if (fullText.includes("override")) {
      modifiers.push("override");
    }
    if (fullText.includes("required")) {
      modifiers.push("required");
    }
    if (fullText.includes("convenience")) {
      modifiers.push("convenience");
    }
    if (fullText.includes("mutating")) {
      modifiers.push("mutating");
    }
    if (fullText.includes("nonmutating")) {
      modifiers.push("nonmutating");
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift function signature
    const funcMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?(?:static\s+|class\s+|final\s+|override\s+)?(?:mutating\s+|nonmutating\s+)?func\s+\w+[^{]*/,
    );

    return funcMatch
      ? funcMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractClassSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift class signature
    const classMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?(?:final\s+)?class\s+\w+(?:\s*:\s*[^{]*)?/,
    );

    return classMatch
      ? classMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractStructSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift struct signature
    const structMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?struct\s+\w+(?:\s*:\s*[^{]*)?/,
    );

    return structMatch
      ? structMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractProtocolSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift protocol signature
    const protocolMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?protocol\s+\w+(?:\s*:\s*[^{]*)?/,
    );

    return protocolMatch
      ? protocolMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractEnumSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift enum signature
    const enumMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?enum\s+\w+(?:\s*:\s*[^{]*)?/,
    );

    return enumMatch
      ? enumMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractPropertySignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift property signature
    const propMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?(?:static\s+|class\s+)?(?:let\s+|var\s+)\w+\s*:\s*[^{=\n]*/,
    );

    return propMatch
      ? propMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractInitializerSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift initializer signature
    const initMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?(?:required\s+|convenience\s+)?init\??[^{]*/,
    );

    return initMatch
      ? initMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private extractExtensionSignature(sourceLines: string[]): string {
    const fullText = sourceLines.join(" ");

    // Match Swift extension signature
    const extensionMatch = fullText.match(
      /(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+)?extension\s+\w+(?:\s*:\s*[^{]*)?/,
    );

    return extensionMatch
      ? extensionMatch[0].trim()
      : ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private parseSwiftParameters(paramStr: string): Parameter[] {
    if (!paramStr.trim()) {
      return [];
    }

    return paramStr.split(",").map((param) => {
      const trimmed = param.trim();

      // Handle external parameter names: externalName internalName: Type
      const externalMatch = trimmed.match(/^(\w+)\s+(\w+)\s*:\s*(.+)$/);
      if (externalMatch) {
        const [, external, internal, type] = externalMatch;
        return { name: `${external} ${internal}`, type: type?.trim() || "Any" };
      }

      // Handle simple parameters: name: Type
      const simpleMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
      if (simpleMatch) {
        const [, name, type] = simpleMatch;
        return { name: name || "param", type: type?.trim() || "Any" };
      }

      // Handle unnamed parameters: _ name: Type
      const unnamedMatch = trimmed.match(/^_\s+(\w+)\s*:\s*(.+)$/);
      if (unnamedMatch) {
        const [, name, type] = unnamedMatch;
        return { name: `_ ${name || "param"}`, type: type?.trim() || "Any" };
      }

      return { name: trimmed, type: "Any" };
    });
  }
}
