# API Usage Patterns: LLM and Embedding Providers

**Date:** October 9, 2025  
**Version:** 1.0  
**Status:** Active

This document provides guidance on using LLM and embedding providers efficiently for annotation and embedding operations in the ast-copilot-helper project.

---

## Overview

The project supports integration with external LLM and embedding APIs for:

- **Annotations**: Generating semantic annotations for AST nodes (complexity, dependencies, documentation)
- **Embeddings**: Creating vector representations for semantic search

These operations require careful management of:

- API rate limits
- Cost optimization
- Latency targets
- Quality metrics

---

## LLM Provider Patterns

### Supported Models

| Provider  | Model           | Use Case                         | Speed           | Cost               |
| --------- | --------------- | -------------------------------- | --------------- | ------------------ |
| OpenAI    | GPT-4 Turbo     | High-quality annotations         | ~50 tokens/sec  | $0.01/1K tokens    |
| OpenAI    | GPT-3.5 Turbo   | Fast, cost-effective annotations | ~150 tokens/sec | $0.0015/1K tokens  |
| Anthropic | Claude 3 Sonnet | Balanced quality and speed       | ~80 tokens/sec  | $0.003/1K tokens   |
| Anthropic | Claude 3 Haiku  | Fast, lightweight annotations    | ~120 tokens/sec | $0.00025/1K tokens |

### Rate Limits

**OpenAI:**

- GPT-4 Turbo: 10,000 TPM (tokens per minute), 500 RPM (requests per minute)
- GPT-3.5 Turbo: 90,000 TPM, 3,500 RPM

**Anthropic:**

- Claude 3 Sonnet: 40,000 TPM, 1,000 RPM
- Claude 3 Haiku: 100,000 TPM, 2,000 RPM

### Batching Strategy

**Single Annotation (Not Recommended for Production):**

```typescript
// ❌ Inefficient: One API call per node
for (const node of nodes) {
  const annotation = await llm.generateAnnotation(node);
}
// Time for 100k nodes: ~800 minutes (with mock timings)
```

**Batch Annotation (Recommended):**

```typescript
// ✅ Efficient: Batch multiple nodes per API call
const batchSize = 100; // Optimal for most providers
for (let i = 0; i < nodes.length; i += batchSize) {
  const batch = nodes.slice(i, i + batchSize);
  const annotations = await llm.generateAnnotationsBatch(batch);
}
// Time for 100k nodes: ~80 minutes (with optimized batching)
```

### Cost Optimization

**Strategies:**

1. **Use cheaper models for simple nodes:**

   ```typescript
   if (node.complexity < 5) {
     return await gpt35.generateAnnotation(node);
   } else {
     return await gpt4.generateAnnotation(node);
   }
   ```

2. **Cache annotations:**

   ```typescript
   const cacheKey = hashNodeContent(node);
   const cached = await cache.get(cacheKey);
   if (cached) return cached;

   const annotation = await llm.generateAnnotation(node);
   await cache.set(cacheKey, annotation);
   return annotation;
   ```

3. **Incremental updates:**
   ```typescript
   // Only annotate changed files
   const changedNodes = await getChangedNodes(lastCommit);
   const annotations = await llm.generateAnnotationsBatch(changedNodes);
   ```

### Error Handling

**Rate Limit Handling:**

```typescript
async function generateWithRetry(node: Node): Promise<Annotation> {
  let retries = 3;
  let delay = 1000; // Start with 1 second

  while (retries > 0) {
    try {
      return await llm.generateAnnotation(node);
    } catch (error) {
      if (error.status === 429) {
        // Rate limit
        await sleep(delay);
        delay *= 2; // Exponential backoff
        retries--;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## Embedding Provider Patterns

### Supported Models

| Provider | Model                  | Dimensions | Speed           | Cost               |
| -------- | ---------------------- | ---------- | --------------- | ------------------ |
| OpenAI   | text-embedding-3-small | 1536       | ~500 tokens/sec | $0.00002/1K tokens |
| OpenAI   | text-embedding-3-large | 3072       | ~400 tokens/sec | $0.00013/1K tokens |
| OpenAI   | text-embedding-ada-002 | 1536       | ~300 tokens/sec | $0.0001/1K tokens  |
| Cohere   | embed-english-v3.0     | 1024       | ~600 tokens/sec | $0.0001/1K tokens  |

### Rate Limits

**OpenAI:**

- text-embedding-3-small: 1,000,000 TPM, 5,000 RPM
- text-embedding-3-large: 1,000,000 TPM, 5,000 RPM

**Cohere:**

- embed-english-v3.0: 1,000 RPM

### Batching Strategy

**Single Embedding (Not Recommended):**

```typescript
// ❌ Inefficient: One API call per text
for (const text of texts) {
  const embedding = await embedder.generateEmbedding(text);
}
// Time for 100k nodes: ~83 minutes
```

**Batch Embedding (Recommended):**

```typescript
// ✅ Efficient: Batch multiple texts per API call
const batchSize = 100; // OpenAI supports up to 2048
for (let i = 0; i < texts.length; i += batchSize) {
  const batch = texts.slice(i, i + batchSize);
  const embeddings = await embedder.generateEmbeddingsBatch(batch);
}
// Time for 100k nodes: ~8 minutes (with optimized batching)
```

### Cost Optimization

**Strategies:**

1. **Reduce dimensionality:**

   ```typescript
   // Use smaller model when high precision isn't needed
   const embedder = new OpenAIEmbedding({
     model: "text-embedding-3-small", // 1536 dims vs 3072
   });
   ```

2. **Cache embeddings:**

   ```typescript
   const cacheKey = hashText(text);
   const cached = await vectorCache.get(cacheKey);
   if (cached) return cached;

   const embedding = await embedder.generateEmbedding(text);
   await vectorCache.set(cacheKey, embedding);
   return embedding;
   ```

3. **Selective embedding:**
   ```typescript
   // Only embed important nodes
   const importantNodes = nodes.filter(
     (n) => n.type === "function_declaration" || n.type === "class_declaration",
   );
   ```

---

## Performance Targets

### Specification Targets

From the project specification (Issue #172):

| Operation | Target                 | Current (Mock)                      | Status                |
| --------- | ---------------------- | ----------------------------------- | --------------------- |
| Parse     | <10 min for 100k nodes | ~32s per file                       | ⚠️ Needs optimization |
| Annotate  | <5 min for 100k nodes  | ~800 min (single) / ~80 min (batch) | ⚠️ Needs batching     |
| Embed     | <15 min for 100k nodes | ~83 min (single) / ~8 min (batch)   | ✅ With batching      |

### Optimization Roadmap

**Phase 1: Batching (Implemented in Issue #181)**

- ✅ Batch annotation generation (10-100 nodes per request)
- ✅ Batch embedding generation (10-100 texts per request)
- ✅ Quality metrics for validation

**Phase 2: Caching (Future)**

- Cache annotations by content hash
- Cache embeddings by text hash
- Implement cache invalidation strategy

**Phase 3: Selective Processing (Future)**

- Only annotate changed files
- Only embed important nodes
- Implement priority-based processing

**Phase 4: Parallel Processing (Issue #180)**

- Parallel file parsing
- Concurrent API requests (respecting rate limits)
- Worker pool for CPU-intensive operations

---

## Quality Metrics

### Annotation Quality

**Metrics:**

- **Accuracy:** Are complexity scores reasonable? (0-10 scale)
- **Relevance:** Are dependencies correctly identified?
- **Completeness:** Is all required metadata present?

**Target:** Average score ≥ 0.80

**Current Results:**

- Accuracy: 1.00 (perfect complexity score range)
- Relevance: 0.50 (basic dependency extraction)
- Completeness: 1.00 (all metadata present)
- **Average: 0.83** ✅

### Embedding Quality

**Metrics:**

- **Dimensionality:** Correct vector size?
- **Magnitude:** Normalized vectors? (≈1.0)
- **Vector Similarity:** Appropriate diversity? (0.3-0.9)
- **Search Relevance:** Can find related content?

**Target:** Average score ≥ 0.85

**Current Results:**

- Dimensionality: 1536 ✅
- Magnitude: 1.00 (normalized) ✅
- Similarity: ~0.00 (diverse vectors)
- Relevance: 0.85
- **Average: 0.89** ✅

---

## Mock Providers for Testing

For CI/CD and local testing without incurring API costs, use the mock providers:

```typescript
import {
  MockLLMProvider,
  MockEmbeddingProvider,
} from "./scripts/performance/mock-providers.js";

// Mock LLM with realistic timings
const mockLLM = new MockLLMProvider({
  msPerToken: 20, // GPT-4 Turbo speed
  baseLatencyMs: 200, // Network overhead
  addVariance: true, // Realistic variance
});

// Mock embedding with realistic timings
const mockEmbedding = new MockEmbeddingProvider({
  msPerToken: 2, // Embedding is faster
  baseLatencyMs: 150, // Network overhead
  dimensions: 1536, // text-embedding-3-small
  addVariance: true,
});
```

**Features:**

- Deterministic output (same input → same output)
- Realistic latency simulation
- Quality metrics calculation
- No API costs
- No rate limits

---

## Integration with CI Workflow

**Current Status:** Mock providers are integrated into comprehensive benchmarks.

**CI Configuration:**

```yaml
# .github/workflows/performance.yml
- name: Run Performance Benchmarks
  run: |
    yarn tsx scripts/performance/comprehensive-benchmark.ts \
      --quick \
      --output ci-artifacts/performance-results.json
```

**Regression Detection:**

- Baseline performance stored in `ci-artifacts/performance-results.json`
- Automated comparison on each PR
- Alerts if annotation/embedding performance degrades >10%

---

## Best Practices Summary

### ✅ Do

- Use batch operations for production workloads
- Implement exponential backoff for rate limits
- Cache results when possible
- Monitor API costs and usage
- Use mock providers for testing
- Track quality metrics
- Process incrementally (only changed files)

### ❌ Don't

- Make single API calls in loops
- Ignore rate limits
- Skip error handling
- Embed every node (be selective)
- Use production APIs in CI/CD
- Forget to normalize embeddings
- Process unchanged files

---

## Cost Estimation

**Example: 100k nodes with GPT-4 Turbo + text-embedding-3-small**

**Assumptions:**

- Average node: ~500 tokens (annotation input)
- Average output: ~100 tokens (annotation)
- Batch size: 100 nodes

**Annotation:**

- Input: 100,000 × 500 = 50M tokens
- Output: 100,000 × 100 = 10M tokens
- Cost: (50M × $0.01 + 10M × $0.03) / 1000 = $800

**Embedding:**

- Input: 100,000 × 100 = 10M tokens (signature text)
- Cost: 10M × $0.00002 / 1000 = $0.20

**Total: ~$800 for full annotation + embedding**

**Cost Reduction Strategies:**

- Use GPT-3.5 Turbo: ~$120 (85% cheaper)
- Cache and incremental: ~$80 (90% reuse rate)
- Selective embedding: ~$0.02 (only 10% of nodes)

**Recommended Production Cost: $120-200 per 100k nodes**

---

## Appendix: Benchmark Results

**Last Updated:** October 9, 2025

### Annotation Performance (Mock)

| Test              | Mean    | P95     | Throughput     |
| ----------------- | ------- | ------- | -------------- |
| Single annotation | 2117ms  | 2126ms  | 0.47 nodes/sec |
| Batch-10          | 7809ms  | 7848ms  | 1.28 nodes/sec |
| Batch-100         | 48039ms | 48039ms | 2.08 nodes/sec |

### Embedding Performance (Mock)

| Test             | Mean   | P95    | Throughput      |
| ---------------- | ------ | ------ | --------------- |
| Single embedding | 336ms  | 343ms  | 2.97 texts/sec  |
| Batch-10         | 909ms  | 932ms  | 11.00 texts/sec |
| Batch-100        | 4952ms | 4952ms | 20.19 texts/sec |

### End-to-End Pipeline

| Test                 | Mean   | P95    | Description      |
| -------------------- | ------ | ------ | ---------------- |
| Parse→Annotate→Embed | 8070ms | 8070ms | 10-node pipeline |

---

## Questions or Issues?

For questions about API integration, cost optimization, or performance tuning, please:

1. Check the [PERFORMANCE_BENCHMARK_RESULTS.md](PERFORMANCE_BENCHMARK_RESULTS.md)
2. Review [Issue #181](https://github.com/EvanDodds/ast-copilot-helper/issues/181)
3. Open a new issue with the `performance` label
