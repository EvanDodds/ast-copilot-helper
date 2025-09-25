/**
 * C# signature extractor
 * Handles C#-specific syntax including properties, attributes, and access modifiers
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class CSharpExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "method":
      case "method_declaration":
        return this.extractMethodSignature(sourceLines);

      case "constructor":
      case "constructor_declaration":
        return this.extractConstructorSignature(sourceLines);

      case "class":
      case "class_declaration":
        return this.extractClassSignature(sourceLines);

      case "interface":
      case "interface_declaration":
        return this.extractInterfaceSignature(sourceLines);

      case "property":
      case "property_declaration":
        return this.extractPropertySignature(sourceLines);

      default:
        return this.extractGenericSignature(sourceLines);
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(" ");

    // Find parameter list in parentheses
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]) {
      return [];
    }

    const paramString = paramMatch[1];
    if (paramString.trim() === "") {
      return [];
    }

    // Split by comma, but respect nested brackets and generics
    const parameters = this.splitParameters(paramString);

    return parameters
      .map((param) => this.parseCSharpParameter(param))
      .filter((param) => param.name.length > 0);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(" ");

    // C# method return type pattern: access_modifier type methodName(
    const returnTypeMatch = signature.match(
      /(?:public|private|protected|internal|static|\s)*\s+(\w+(?:<[^>]*>)?)\s+\w+\s*\(/,
    );
    if (returnTypeMatch && returnTypeMatch[1]) {
      const returnType = returnTypeMatch[1].trim();
      return returnType === "void" ? null : returnType;
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    return ExtractionUtils.extractModifiers(node, sourceLines);
  }

  private extractMethodSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "public",
      "private",
      "protected",
      "internal",
      "static",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractConstructorSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "public",
      "private",
      "protected",
      "internal",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractClassSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "class",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractInterfaceSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "interface",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractPropertySignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "public",
      "private",
      "protected",
      "internal",
      "get",
      "set",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractGenericSignature(sourceLines: string[]): string {
    return ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private splitParameters(paramString: string): string[] {
    const parameters: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramString) {
      if (char === "<") {
        depth++;
      } else if (char === ">") {
        depth--;
      } else if (char === "," && depth === 0) {
        parameters.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }

    if (current.trim()) {
      parameters.push(current.trim());
    }

    return parameters;
  }

  private parseCSharpParameter(paramString: string): Parameter {
    const param = paramString.trim();

    // C# parameter pattern: [ref/out/in] Type name [= defaultValue]
    const paramMatch = param.match(
      /^(?:ref\s+|out\s+|in\s+)?(\w+(?:<[^>]*>)?(?:\[\])*[?]?)\s+(\w+)(?:\s*=\s*(.+))?$/,
    );

    if (paramMatch && paramMatch[2]) {
      return {
        name: paramMatch[2],
        type: paramMatch[1] || "unknown",
        defaultValue: paramMatch[3] || undefined,
        optional: !!paramMatch[3],
      };
    }

    // If pattern doesn't match, try to extract just the name
    const words = param.split(/\s+/);
    if (words.length >= 2) {
      return {
        name: words[words.length - 1] || "unknown",
        type: words.slice(0, -1).join(" "),
        defaultValue: undefined,
        optional: false,
      };
    }

    return {
      name: param || "unknown",
      type: "unknown",
      defaultValue: undefined,
      optional: false,
    };
  }
}
