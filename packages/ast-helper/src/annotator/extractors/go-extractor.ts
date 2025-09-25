/**
 * Go signature extractor
 * Handles Go-specific syntax including functions, methods, interfaces, and structs
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class GoExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_declaration":
        return this.extractFunctionSignature(sourceLines);

      case "method":
      case "method_declaration":
        return this.extractMethodSignature(sourceLines);

      case "type":
      case "type_declaration":
        return this.extractTypeSignature(sourceLines);

      case "interface":
      case "interface_type":
        return this.extractInterfaceSignature(sourceLines);

      case "struct":
      case "struct_type":
        return this.extractStructSignature(sourceLines);

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

    // Split by comma for Go parameters
    const parameters = paramString.split(",").map((p) => p.trim());

    return parameters
      .map((param) => this.parseGoParameter(param))
      .filter((param) => param.name.length > 0);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(" ");

    // Go function return type pattern: func name() returnType or func name() (returnType1, returnType2)
    const returnTypeMatch = signature.match(/\)\s*([^{]+)/);
    if (returnTypeMatch && returnTypeMatch[1]) {
      return returnTypeMatch[1].trim();
    }

    return null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    // Go doesn't have explicit access modifiers, visibility is determined by capitalization
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const signature = sourceLines.join(" ");

    // Check if the identifier starts with uppercase (exported) or lowercase (unexported)
    const identifierMatch = signature.match(
      /(?:func|type|var|const)\s+([A-Za-z_]\w*)/,
    );
    if (identifierMatch && identifierMatch[1]) {
      const identifier = identifierMatch[1];
      const firstChar = identifier.charAt(0);
      return firstChar >= "A" && firstChar <= "Z" ? ["public"] : ["private"];
    }

    return [];
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "func",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractMethodSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "func",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractTypeSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "type",
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

  private extractStructSignature(sourceLines: string[]): string {
    const declarationLine = ExtractionUtils.findDeclarationLine(sourceLines, [
      "struct",
    ]);
    if (!declarationLine) {
      return sourceLines[0] || "";
    }

    return ExtractionUtils.cleanSignature(declarationLine);
  }

  private extractGenericSignature(sourceLines: string[]): string {
    return ExtractionUtils.cleanSignature(sourceLines.join(" "));
  }

  private parseGoParameter(paramString: string): Parameter {
    const param = paramString.trim();

    // Go parameter patterns:
    // name type
    // name, name2 type
    // type (unnamed parameter)
    const paramMatch = param.match(/^(.+?)\s+(.+)$/);

    if (paramMatch && paramMatch[1] && paramMatch[2]) {
      // Check if first part contains commas (multiple names with same type)
      if (paramMatch[1].includes(",")) {
        const names = paramMatch[1].split(",").map((n) => n.trim());
        // Return first name for simplicity, could be enhanced to handle multiple names
        return {
          name: names[0] || "unknown",
          type: paramMatch[2],
          defaultValue: undefined,
          optional: false,
        };
      } else {
        return {
          name: paramMatch[1],
          type: paramMatch[2],
          defaultValue: undefined,
          optional: false,
        };
      }
    }

    // Unnamed parameter (just type)
    if (!param.includes(" ")) {
      return {
        name: "unnamed",
        type: param,
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
