/**
 * Kotlin signature extractor
 * Handles Kotlin-specific syntax including functions, classes, interfaces,
 * objects, data classes, and Kotlin-specific features
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class KotlinExtractor implements SignatureExtractor {
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

      case "interface":
      case "interface_declaration":
        return this.extractInterfaceSignature(sourceLines);

      case "object":
      case "object_declaration":
        return this.extractObjectSignature(sourceLines);

      case "enum":
      case "enum_class":
        return this.extractEnumSignature(sourceLines);

      case "property":
      case "property_declaration":
        return this.extractPropertySignature(sourceLines);

      case "constructor":
      case "primary_constructor":
      case "secondary_constructor":
        return this.extractConstructorSignature(sourceLines);

      case "companion":
      case "companion_object":
        return this.extractCompanionSignature(sourceLines);

      case "sealed":
      case "sealed_class":
        return this.extractSealedClassSignature(sourceLines);

      case "data":
      case "data_class":
        return this.extractDataClassSignature(sourceLines);

      default:
        return sourceLines.length > 0 ? sourceLines[0]?.trim() || "" : "";
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Find function/method/constructor declaration
    const funcLine = sourceLines.find(
      (line) =>
        (line.includes("fun ") || line.includes("constructor")) &&
        line.includes("("),
    );

    if (!funcLine) {
      return [];
    }

    return this.parseKotlinParameters(funcLine, sourceLines);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Look for return type after : in function signature
    const returnTypeLine = sourceLines.find(
      (line) =>
        (line.includes("fun ") || line.includes("->")) && line.includes(":"),
    );

    if (!returnTypeLine) {
      return null;
    }

    const returnMatch = returnTypeLine.match(/:\s*([^{=]+)/);
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
      if (line.includes("internal")) {
        modifiers.push("internal");
      }
      if (line.includes("open")) {
        modifiers.push("open");
      }
      if (line.includes("final")) {
        modifiers.push("final");
      }
      if (line.includes("abstract")) {
        modifiers.push("abstract");
      }
      if (line.includes("sealed")) {
        modifiers.push("sealed");
      }
      if (line.includes("data")) {
        modifiers.push("data");
      }
      if (line.includes("inline")) {
        modifiers.push("inline");
      }
      if (line.includes("suspend")) {
        modifiers.push("suspend");
      }
      if (line.includes("override")) {
        modifiers.push("override");
      }
      if (line.includes("companion")) {
        modifiers.push("companion");
      }
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    // Find function declaration
    const functionLine = sourceLines.find((line) => line.includes("fun "));

    if (!functionLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract function signature, potentially spanning multiple lines
    let signature = functionLine.trim();

    // If the line doesn't end with { or =, it might continue on next lines
    if (!functionLine.includes("{") && !functionLine.includes(" =")) {
      const startIndex = sourceLines.indexOf(functionLine);
      for (let i = startIndex + 1; i < sourceLines.length; i++) {
        const nextLine = sourceLines[i];
        if (nextLine) {
          signature += " " + nextLine.trim();
          if (nextLine.includes("{") || nextLine.includes(" =")) {
            break;
          }
        }
      }
    }

    // Clean up the signature
    return signature.replace(/\s*[{=].*$/, "").trim();
  }

  private extractClassSignature(sourceLines: string[]): string {
    const classLine = sourceLines.find((line) => line.includes("class "));

    if (!classLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract class name, generics, inheritance
    return classLine.replace(/\s*[{:].*$/, "").trim();
  }

  private extractInterfaceSignature(sourceLines: string[]): string {
    const interfaceLine = sourceLines.find((line) =>
      line.includes("interface "),
    );

    if (!interfaceLine) {
      return sourceLines[0]?.trim() || "";
    }

    return interfaceLine.replace(/\s*[{:].*$/, "").trim();
  }

  private extractObjectSignature(sourceLines: string[]): string {
    const objectLine = sourceLines.find((line) => line.includes("object "));

    if (!objectLine) {
      return sourceLines[0]?.trim() || "";
    }

    return objectLine.replace(/\s*[{:].*$/, "").trim();
  }

  private extractEnumSignature(sourceLines: string[]): string {
    const enumLine = sourceLines.find(
      (line) => line.includes("enum ") || line.includes("enum class"),
    );

    if (!enumLine) {
      return sourceLines[0]?.trim() || "";
    }

    return enumLine.replace(/\s*[{(].*$/, "").trim();
  }

  private extractPropertySignature(sourceLines: string[]): string {
    const propertyLine = sourceLines.find(
      (line) => line.includes("val ") || line.includes("var "),
    );

    if (!propertyLine) {
      return sourceLines[0]?.trim() || "";
    }

    return propertyLine.replace(/\s*[={].*$/, "").trim();
  }

  private extractConstructorSignature(sourceLines: string[]): string {
    const constructorLine = sourceLines.find(
      (line) =>
        line.includes("constructor") ||
        (line.includes("(") && sourceLines.some((l) => l.includes("class"))),
    );

    if (!constructorLine) {
      return sourceLines[0]?.trim() || "";
    }

    return constructorLine.replace(/\s*[:{].*$/, "").trim();
  }

  private extractCompanionSignature(sourceLines: string[]): string {
    const companionLine = sourceLines.find((line) =>
      line.includes("companion object"),
    );

    if (!companionLine) {
      return sourceLines[0]?.trim() || "";
    }

    return companionLine.replace(/\s*[{:].*$/, "").trim();
  }

  private extractSealedClassSignature(sourceLines: string[]): string {
    const sealedLine = sourceLines.find(
      (line) =>
        line.includes("sealed class") || line.includes("sealed interface"),
    );

    if (!sealedLine) {
      return sourceLines[0]?.trim() || "";
    }

    return sealedLine.replace(/\s*[{:(].*$/, "").trim();
  }

  private extractDataClassSignature(sourceLines: string[]): string {
    const dataLine = sourceLines.find((line) => line.includes("data class"));

    if (!dataLine) {
      return sourceLines[0]?.trim() || "";
    }

    return dataLine.replace(/\s*[{:(].*$/, "").trim();
  }

  private parseKotlinParameters(
    funcLine: string,
    sourceLines: string[],
  ): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract full parameter list, potentially spanning multiple lines
    let fullParamString = funcLine;

    if (!funcLine.includes(")")) {
      const paramStart = sourceLines.indexOf(funcLine);
      for (let i = paramStart + 1; i < sourceLines.length; i++) {
        const nextLine = sourceLines[i];
        if (nextLine) {
          fullParamString += " " + nextLine.trim();
          if (nextLine.includes(")")) {
            break;
          }
        }
      }
    }

    // Extract parameter list from parentheses
    const paramMatch = fullParamString.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]?.trim()) {
      return parameters;
    }

    const paramStr = paramMatch[1].trim();

    // Split parameters by comma (handling generics and nested structures)
    const parts = this.splitKotlinParameters(paramStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const param = this.parseKotlinParameter(trimmed);
      if (param) {
        parameters.push(param);
      }
    }

    return parameters;
  }

  private splitKotlinParameters(paramStr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inAngles = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];

      if (char === "<") {
        inAngles++;
      } else if (char === ">") {
        inAngles--;
      } else if (char === "(" || char === "[" || char === "{") {
        depth++;
      } else if (char === ")" || char === "]" || char === "}") {
        depth--;
      } else if (char === "," && depth === 0 && inAngles === 0) {
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

  private parseKotlinParameter(paramStr: string): Parameter | null {
    const trimmed = paramStr.trim();

    // Kotlin parameter patterns:
    // name: Type
    // name: Type = default
    // vararg name: Type
    // crossinline name: () -> Unit
    // noinline name: () -> Unit

    // Handle vararg
    if (trimmed.startsWith("vararg ")) {
      const varargMatch = trimmed.match(/^vararg\s+(\w+):\s*(.+?)(?:\s*=.*)?$/);
      if (varargMatch) {
        return {
          name: varargMatch[1] || "",
          type: `vararg ${varargMatch[2]?.trim() || ""}`,
          optional: trimmed.includes("="),
        };
      }
    }

    // Handle crossinline/noinline
    if (trimmed.startsWith("crossinline ") || trimmed.startsWith("noinline ")) {
      const inlineMatch = trimmed.match(
        /^(crossinline|noinline)\s+(\w+):\s*(.+?)(?:\s*=.*)?$/,
      );
      if (inlineMatch) {
        return {
          name: inlineMatch[2] || "",
          type: `${inlineMatch[1]} ${inlineMatch[3]?.trim() || ""}`,
          optional: trimmed.includes("="),
        };
      }
    }

    // Regular parameter: name: Type = default
    const regularMatch = trimmed.match(/^(\w+):\s*(.+?)(?:\s*=.*)?$/);
    if (regularMatch) {
      return {
        name: regularMatch[1] || "",
        type: regularMatch[2]?.trim() || "",
        optional:
          trimmed.includes("=") || regularMatch[2]?.includes("?") || false,
      };
    }

    return null;
  }
}
