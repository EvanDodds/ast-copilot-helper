# Advanced Annotations Guide

This guide covers the sophisticated annotation system implementation for AST Copilot Helper, providing comprehensive metadata management, contextual analysis, and intelligent annotation generation.

## Overview

The advanced annotation system provides:

- **Rich Metadata Management**: Comprehensive node annotations and metadata tracking
- **Contextual Analysis**: Intelligent context-aware annotation generation
- **Relationship Mapping**: Complex dependency and relationship tracking
- **Performance Optimization**: Efficient annotation storage and retrieval
- **Extensible Framework**: Plugin-based annotation system

## Architecture

### Core Components

#### 1. Annotation Manager (`packages/ast-helper/src/annotations/`)

Central coordinator for annotation operations:

```typescript
import { AnnotationManager } from "@ast-copilot-helper/ast-helper";

const annotationManager = new AnnotationManager({
  enableCaching: true,
  enableRelationships: true,
  enableContextAnalysis: true,
});

// Annotate AST nodes
const annotatedNodes = await annotationManager.annotateNodes(astNodes, {
  includeTypes: ["function", "class", "interface"],
  analysisDepth: "deep",
  enableMetrics: true,
});
```

#### 2. Metadata Engine

Advanced metadata extraction and management:

```typescript
interface NodeAnnotation {
  id: string;
  nodeId: string;
  type: AnnotationType;
  metadata: AnnotationMetadata;
  relationships: Relationship[];
  context: ContextualInfo;
  timestamp: number;
  version: string;
}

interface AnnotationMetadata {
  // Core properties
  name?: string;
  description?: string;
  category: string;
  tags: string[];

  // Structural metadata
  complexity: ComplexityMetrics;
  dependencies: DependencyInfo[];
  exports: ExportInfo[];
  imports: ImportInfo[];

  // Quality metadata
  documentation: DocumentationInfo;
  testCoverage?: CoverageInfo;
  codeSmells: CodeSmellInfo[];

  // Performance metadata
  performanceHints: PerformanceHint[];
  resourceUsage: ResourceUsageInfo;
}
```

#### 3. Context Analyzer

Intelligent contextual analysis for enhanced annotations:

```typescript
interface ContextualInfo {
  scope: ScopeInfo;
  enclosingStructures: StructureInfo[];
  semanticRole: SemanticRole;
  usagePatterns: UsagePattern[];
  businessLogic: BusinessLogicInfo;
}
```

## Usage Examples

### Basic Annotation

```typescript
import { annotateAST } from "@ast-copilot-helper/ast-helper";

// Parse and annotate code
const result = await annotateAST(
  `
  /**
   * Calculates compound interest
   * @param principal Initial amount
   * @param rate Interest rate (decimal)
   * @param time Time period in years
   */
  function calculateCompoundInterest(principal: number, rate: number, time: number): number {
    return principal * Math.pow(1 + rate, time);
  }
`,
  "typescript",
);

// Access annotations
result.nodes.forEach((node) => {
  if (node.annotations) {
    console.log(`${node.type}: ${node.annotations.metadata.description}`);
    console.log(
      `Complexity: ${node.annotations.metadata.complexity.cognitive}`,
    );
  }
});
```

### Advanced Configuration

```typescript
import {
  AnnotationManager,
  AnnotationConfig,
} from "@ast-copilot-helper/ast-helper";

const config: AnnotationConfig = {
  // Core settings
  enableCaching: true,
  cacheSize: 1000,
  cacheTTL: 3600000, // 1 hour

  // Analysis depth
  analysisDepth: "comprehensive",
  includeRelationships: true,
  includeMetrics: true,
  includeDocumentation: true,

  // Context analysis
  contextAnalysis: {
    enableSemanticAnalysis: true,
    enableBusinessLogicDetection: true,
    enablePatternRecognition: true,
    maxContextDepth: 5,
  },

  // Performance optimization
  batchSize: 50,
  maxConcurrency: 4,
  enableStreaming: true,

  // Quality analysis
  qualityAnalysis: {
    enableComplexityMetrics: true,
    enableCodeSmellDetection: true,
    enablePerformanceAnalysis: true,
    enableSecurityAnalysis: true,
  },
};

const manager = new AnnotationManager(config);
```

## Annotation Types

### Structural Annotations

Annotations for code structure and organization:

```typescript
interface StructuralAnnotation {
  type: "structural";
  subtype: "class" | "function" | "interface" | "module" | "namespace";

  metadata: {
    name: string;
    visibility: "public" | "private" | "protected" | "internal";
    modifiers: string[];
    genericParameters?: GenericParameter[];

    // Inheritance information
    extends?: string[];
    implements?: string[];
    mixins?: string[];

    // Size metrics
    lineCount: number;
    statementCount: number;
    parameterCount?: number;
    methodCount?: number;
  };
}
```

### Semantic Annotations

Annotations for semantic meaning and purpose:

```typescript
interface SemanticAnnotation {
  type: "semantic";
  subtype:
    | "business_logic"
    | "utility"
    | "infrastructure"
    | "test"
    | "configuration";

  metadata: {
    purpose: string;
    domain: string;
    businessValue: "high" | "medium" | "low";

    // Semantic relationships
    conceptualDependencies: string[];
    businessRules: BusinessRule[];
    dataFlow: DataFlowInfo[];

    // Intent analysis
    primaryIntent: string;
    secondaryIntents: string[];
    sideEffects: SideEffectInfo[];
  };
}
```

### Quality Annotations

Annotations for code quality and maintainability:

```typescript
interface QualityAnnotation {
  type: "quality";

  metadata: {
    // Complexity metrics
    complexity: {
      cyclomatic: number;
      cognitive: number;
      halstead: HalsteadMetrics;
      maintainability: number; // 0-100 scale
    };

    // Code smells
    codeSmells: {
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      suggestion: string;
      line?: number;
    }[];

    // Documentation quality
    documentation: {
      hasDocumentation: boolean;
      documentationQuality: number; // 0-100 scale
      missingDocumentation: string[];
      outdatedDocumentation: string[];
    };

    // Test coverage
    testCoverage?: {
      linesCovered: number;
      totalLines: number;
      branchesCovered: number;
      totalBranches: number;
      coveragePercentage: number;
    };
  };
}
```

### Performance Annotations

Annotations for performance characteristics:

```typescript
interface PerformanceAnnotation {
  type: "performance";

  metadata: {
    // Performance characteristics
    timeComplexity: string; // O(n), O(log n), etc.
    spaceComplexity: string;
    expectedLoad: "low" | "medium" | "high";

    // Resource usage
    resourceUsage: {
      cpu: "low" | "medium" | "high";
      memory: "low" | "medium" | "high";
      io: "low" | "medium" | "high";
      network: "low" | "medium" | "high";
    };

    // Performance hints
    optimizationOpportunities: {
      type: string;
      description: string;
      impact: "low" | "medium" | "high";
      effort: "low" | "medium" | "high";
    }[];

    // Bottleneck detection
    potentialBottlenecks: {
      type: "cpu" | "memory" | "io" | "network";
      location: string;
      severity: number; // 1-10 scale
      mitigation: string;
    }[];
  };
}
```

## Relationship Mapping

### Dependency Relationships

Track dependencies between code elements:

```typescript
interface DependencyRelationship {
  type: "dependency";
  source: string; // Source node ID
  target: string; // Target node ID

  metadata: {
    dependencyType: "import" | "inheritance" | "composition" | "usage" | "call";
    strength: "weak" | "medium" | "strong";
    direction: "unidirectional" | "bidirectional";

    // Dependency details
    reason: string;
    location: SourceLocation;
    isOptional: boolean;
    isCyclic: boolean;
  };
}
```

### Hierarchical Relationships

Track structural hierarchies:

```typescript
interface HierarchicalRelationship {
  type: "hierarchy";
  parent: string;
  child: string;

  metadata: {
    hierarchyType:
      | "containment"
      | "inheritance"
      | "implementation"
      | "namespace";
    depth: number;
    path: string[];

    // Hierarchy metadata
    isDirectChild: boolean;
    siblingCount: number;
    childCount: number;
  };
}
```

### Functional Relationships

Track functional interactions:

```typescript
interface FunctionalRelationship {
  type: "functional";
  caller: string;
  callee: string;

  metadata: {
    callType: "direct" | "indirect" | "callback" | "event";
    frequency: "rare" | "occasional" | "frequent" | "constant";

    // Call context
    callSites: CallSiteInfo[];
    parameters: ParameterInfo[];
    returnValues: ReturnValueInfo[];

    // Flow analysis
    dataFlow: DataFlowInfo[];
    controlFlow: ControlFlowInfo[];
  };
}
```

## Context Analysis

### Scope Analysis

Analyze variable and function scopes:

```typescript
interface ScopeInfo {
  type: "global" | "module" | "function" | "block" | "class";
  depth: number;
  parent?: string;
  children: string[];

  // Scope contents
  variables: VariableInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];

  // Scope characteristics
  isClosureScope: boolean;
  capturedVariables: string[];
  escapedVariables: string[];
}
```

### Semantic Role Analysis

Determine the semantic role of code elements:

```typescript
interface SemanticRole {
  primary: string; // 'data_access', 'business_logic', 'presentation', etc.
  secondary: string[]; // Additional roles
  confidence: number; // 0-1 confidence score

  // Role-specific metadata
  patterns: DetectedPattern[];
  antiPatterns: DetectedAntiPattern[];

  // Architectural significance
  architecturalLayer: "presentation" | "business" | "data" | "infrastructure";
  designPatterns: DesignPattern[];
}
```

### Usage Pattern Analysis

Analyze how code elements are used:

```typescript
interface UsagePattern {
  pattern: string; // 'singleton', 'factory', 'observer', etc.
  frequency: number; // How often this pattern appears
  confidence: number; // 0-1 confidence score

  // Pattern details
  participants: string[];
  collaborations: Collaboration[];
  consequences: string[];

  // Usage context
  contexts: UsageContext[];
  variations: PatternVariation[];
}
```

## Performance Optimization

### Caching Strategy

Optimize annotation performance with intelligent caching:

```typescript
const manager = new AnnotationManager({
  caching: {
    enabled: true,
    strategy: "adaptive", // 'lru', 'lfu', 'adaptive'
    maxSize: 2000,
    ttl: 7200000, // 2 hours

    // Cache warming
    preloadPatterns: ["src/**/*.ts", "lib/**/*.ts"],
    backgroundRefresh: true,

    // Cache invalidation
    invalidateOnChange: true,
    dependencies: ["package.json", "tsconfig.json"],
  },
});
```

### Batch Processing

Process annotations in optimized batches:

```typescript
const results = await manager.annotateNodesBatch(nodes, {
  batchSize: 100,
  maxConcurrency: 6,

  // Batch optimization
  groupByType: true,
  prioritizeHeavyNodes: true,
  enableStreaming: true,

  // Progress tracking
  onProgress: (completed, total) => {
    console.log(`Annotated ${completed}/${total} nodes`);
  },

  onBatchComplete: (batch, results) => {
    console.log(`Batch of ${batch.length} nodes completed`);
  },
});
```

### Incremental Updates

Update annotations incrementally for changed code:

```typescript
const manager = new AnnotationManager({
  incrementalUpdates: {
    enabled: true,
    strategy: "smart_diff",

    // Change detection
    trackDependencies: true,
    propagateChanges: true,

    // Update optimization
    batchUpdates: true,
    deferNonCritical: true,
  },
});

// Update annotations for changed files
await manager.updateAnnotations(changedFiles);
```

## Integration Examples

### IDE Integration

Integrate annotations with development environments:

```typescript
import { AnnotationManager } from "@ast-copilot-helper/ast-helper";

class IDEAnnotationProvider {
  private manager: AnnotationManager;

  constructor() {
    this.manager = new AnnotationManager({
      enableRealTimeUpdates: true,
      provideDiagnostics: true,
      enableHover: true,
      enableCodeLens: true,
    });
  }

  async provideHover(document: Document, position: Position) {
    const node = await this.findNodeAtPosition(document, position);
    const annotations = await this.manager.getAnnotations(node.id);

    return {
      contents: [
        `**${node.type}**: ${node.name}`,
        `Complexity: ${annotations.metadata.complexity.cognitive}`,
        `Dependencies: ${annotations.relationships.length}`,
        annotations.metadata.description || "No description available",
      ],
    };
  }

  async provideCodeLens(document: Document) {
    const annotations = await this.manager.getDocumentAnnotations(document.uri);

    return annotations
      .filter((a) => a.metadata.complexity.cognitive > 10)
      .map((a) => ({
        range: a.range,
        command: {
          title: `Complexity: ${a.metadata.complexity.cognitive}`,
          command: "ast-helper.showComplexityDetails",
          arguments: [a.id],
        },
      }));
  }
}
```

### Documentation Generation

Generate documentation from annotations:

```typescript
class DocumentationGenerator {
  private manager: AnnotationManager;

  async generateDocumentation(sourceFiles: string[]) {
    const annotations = await this.manager.annotateFiles(sourceFiles);

    const documentation = {
      overview: this.generateOverview(annotations),
      modules: this.generateModuleDocumentation(annotations),
      classes: this.generateClassDocumentation(annotations),
      functions: this.generateFunctionDocumentation(annotations),
      dependencies: this.generateDependencyDiagram(annotations),
    };

    return documentation;
  }

  private generateOverview(annotations: Annotation[]) {
    const metrics = this.calculateMetrics(annotations);

    return {
      totalFiles: metrics.fileCount,
      totalClasses: metrics.classCount,
      totalFunctions: metrics.functionCount,
      averageComplexity: metrics.averageComplexity,
      codeSmells: metrics.codeSmellCount,
      testCoverage: metrics.testCoverage,
    };
  }
}
```

### Quality Gates

Implement quality gates based on annotations:

```typescript
class QualityGateChecker {
  private manager: AnnotationManager;

  async checkQualityGates(files: string[]): Promise<QualityReport> {
    const annotations = await this.manager.annotateFiles(files);

    const report: QualityReport = {
      passed: true,
      issues: [],
      metrics: {},
    };

    // Check complexity thresholds
    const complexFunctions = annotations.filter(
      (a) => a.type === "quality" && a.metadata.complexity.cognitive > 15,
    );

    if (complexFunctions.length > 0) {
      report.passed = false;
      report.issues.push({
        type: "complexity",
        severity: "high",
        message: `${complexFunctions.length} functions exceed complexity threshold`,
        locations: complexFunctions.map((f) => f.location),
      });
    }

    // Check code smells
    const criticalSmells = annotations.flatMap(
      (a) =>
        a.metadata.codeSmells?.filter((s) => s.severity === "critical") || [],
    );

    if (criticalSmells.length > 0) {
      report.passed = false;
      report.issues.push({
        type: "code_smells",
        severity: "critical",
        message: `${criticalSmells.length} critical code smells detected`,
        details: criticalSmells,
      });
    }

    return report;
  }
}
```

## Custom Annotation Plugins

### Plugin Architecture

Create custom annotation plugins:

```typescript
interface AnnotationPlugin {
  name: string;
  version: string;
  dependencies?: string[];

  annotate(node: ASTNode, context: AnnotationContext): Promise<Annotation[]>;
  cleanup?(): Promise<void>;
}

class BusinessLogicPlugin implements AnnotationPlugin {
  name = "business-logic-analyzer";
  version = "1.0.0";

  async annotate(
    node: ASTNode,
    context: AnnotationContext,
  ): Promise<Annotation[]> {
    if (node.type !== "function") return [];

    const businessLogicScore = this.analyzeBusinessLogic(node, context);

    if (businessLogicScore > 0.7) {
      return [
        {
          id: `business-${node.id}`,
          nodeId: node.id,
          type: "semantic",
          metadata: {
            category: "business_logic",
            businessValue: businessLogicScore > 0.9 ? "high" : "medium",
            domain: this.detectDomain(node, context),
            confidence: businessLogicScore,
          },
        },
      ];
    }

    return [];
  }

  private analyzeBusinessLogic(
    node: ASTNode,
    context: AnnotationContext,
  ): number {
    // Custom business logic analysis
    return 0.8;
  }

  private detectDomain(node: ASTNode, context: AnnotationContext): string {
    // Domain detection logic
    return "financial";
  }
}

// Register plugin
manager.registerPlugin(new BusinessLogicPlugin());
```

## API Reference

For detailed API documentation, see:

- [Annotations API Reference](../api/advanced-features.md#advanced-annotation-features)
- [Plugin Development Guide](../api/interfaces.md#annotation-plugins)
- [Configuration Reference](../api/cli.md#annotation-options)

## Examples

Complete working examples are available in:

- [Advanced Annotations Examples](../examples/advanced-features.md#advanced-annotation-features)
- [Plugin Development Examples](../examples/integrations.md#annotation-plugins)

---

_This guide is part of the advanced features implementation. For the complete feature overview, see [Advanced Features Guide](./advanced-features.md)._
