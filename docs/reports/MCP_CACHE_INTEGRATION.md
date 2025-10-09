# MCP Client Cache Integration

This document describes how the MCP Client integrates with the Query Cache system to provide enhanced performance and visibility.

## Overview

The AST Copilot Helper uses a multi-level caching system to optimize query performance:

- **L1 Cache**: In-memory LRU cache (fastest, limited size)
- **L2 Cache**: Disk-based cache (fast, larger capacity)
- **L3 Cache**: Database cache (persistent, unlimited)

The VS Code extension integrates with this cache system through the MCP protocol, providing:

1. **Automatic cache detection** - Tool responses include cache metadata
2. **Visual cache indicators** - Output channel shows cache hits/misses
3. **Cache management tools** - Commands to view stats, warm, and prune cache
4. **Performance metrics** - Detailed timing information for each query

## Features

### 1. Automatic Cache Logging

When you invoke any query tool (semantic_query, signature_query, etc.), the extension automatically detects and logs cache information:

```
📤 Calling tool: semantic_query with args: {"text":"authentication","maxResults":5}
💾 Cache HIT (L1) - Age: 125ms - Saved 450ms
⚡ Performance: Total=50ms, Vector=25ms, Ranking=15ms
✅ Tool semantic_query completed in 50ms
```

**Cache Indicators:**

- 💾 Cache HIT - Query result was found in cache
- 🔍 Cache MISS - Query was executed and result cached
- (L1/L2/L3) - Cache level that served the result

### 2. Cache Management Tools

Three new MCP tools are available for cache management:

#### `cache_stats` - Get Cache Statistics

Retrieves comprehensive cache performance metrics.

**Usage:**

```typescript
await clientManager.getCacheStats(true);
```

**Response includes:**

- Hit/miss rates for each cache level
- Total cache size and entry count
- Average query times
- Cache effectiveness metrics

#### `cache_warm` - Pre-warm Cache

Pre-loads common queries into cache for faster initial response.

**Usage:**

```typescript
await clientManager.warmCache([
  "error handling",
  "database connection",
  "api endpoints",
]);
```

**Benefits:**

- Faster response for frequently used queries
- Reduced latency for new sessions
- Optimizes cold-start performance

#### `cache_prune` - Prune Cache Entries

Removes old or least-used cache entries to manage memory.

**Usage:**

```typescript
await clientManager.pruneCache("lru", 10); // Keep only 10 most recent
```

**Strategies:**

- `lru` - Least Recently Used
- `age` - Oldest entries first
- `size` - Largest entries first

### 3. Performance Metrics

Every query response includes detailed performance metrics:

```json
{
  "queryMetadata": {
    "cacheInfo": {
      "cacheHit": true,
      "cacheLevel": "L1",
      "cacheAge": 125
    },
    "performanceMetrics": {
      "totalTime": 50,
      "vectorSearchTime": 25,
      "rankingTime": 15,
      "formattingTime": 10
    }
  }
}
```

### 4. VS Code Commands

New commands available in the Command Palette:

- **AST Helper: Test Cache** - Run comprehensive cache integration tests
- **AST Helper: Show Cache Stats** - Display current cache statistics
- **AST Helper: Warm Cache** - Pre-load common queries
- **AST Helper: Prune Cache** - Clean up old cache entries

## Usage Examples

### Example 1: Monitor Cache Performance

```typescript
// Get initial stats
const initialStats = await clientManager.getCacheStats(true);
console.log("Cache hit rate:", initialStats.hitRate);

// Perform query
await client.callTool({
  name: "semantic_query",
  arguments: { text: "authentication", maxResults: 5 },
});

// Check updated stats
const updatedStats = await clientManager.getCacheStats(true);
console.log("New hit rate:", updatedStats.hitRate);
```

### Example 2: Optimize Cold Start

```typescript
// Warm cache on extension activation
await clientManager.warmCache([
  "authentication",
  "error handling",
  "database connection",
  "api endpoints",
]);

// Subsequent queries will be much faster
```

### Example 3: Manage Cache Size

```typescript
// Get current cache stats
const stats = await clientManager.getCacheStats(true);

if (stats.l1.size > 100) {
  // Prune to keep only 50 most recent entries
  await clientManager.pruneCache("lru", 50);
}
```

## Testing

### Automated Cache Tests

Run the cache integration test to verify everything works:

```bash
# In VS Code
Cmd+Shift+P → "AST Helper: Test Cache"
```

This runs 8 comprehensive tests:

1. Get initial cache statistics
2. Perform query (cache MISS expected)
3. Repeat query (cache HIT expected)
4. Get updated statistics
5. Warm cache with common queries
6. Get statistics after warming
7. Prune cache entries
8. Verify pruning worked

### Manual Testing

1. **Test Cache Miss:**

   ```
   Run a unique query → Should see "🔍 Cache MISS"
   ```

2. **Test Cache Hit:**

   ```
   Repeat the same query → Should see "💾 Cache HIT"
   ```

3. **Test Performance:**
   ```
   Compare times for cache MISS vs HIT
   HIT should be significantly faster (10-100x)
   ```

## Cache Configuration

The cache behavior is configured in the server settings:

```typescript
{
  "l1MaxEntries": 100,        // Max entries in memory cache
  "l2MaxSizeBytes": 10485760, // Max disk cache size (10MB)
  "l3TtlMs": 86400000,        // Database cache TTL (24 hours)
  "enabled": true             // Enable/disable caching
}
```

## Performance Impact

Typical performance improvements with cache:

| Query Type | Without Cache | With Cache (L1) | Speedup |
| ---------- | ------------- | --------------- | ------- |
| Semantic   | 200-500ms     | 5-20ms          | 10-100x |
| Signature  | 100-300ms     | 3-15ms          | 20-100x |
| File       | 50-150ms      | 2-10ms          | 25-75x  |

**Note:** Actual times vary based on:

- Index size
- Query complexity
- System resources
- Cache level (L1 > L2 > L3)

## Troubleshooting

### Cache Not Working

1. **Check cache is enabled:**

   ```typescript
   const stats = await clientManager.getCacheStats();
   console.log("Enabled:", stats.enabled);
   ```

2. **Check connection:**

   ```typescript
   console.log("Connected:", clientManager.isConnected());
   ```

3. **Check output channel:**
   Look for cache indicators (💾 or 🔍) in the output

### Low Cache Hit Rate

If hit rate is < 20%:

1. **Warm cache with common queries**
2. **Increase L1 cache size**
3. **Check query patterns** - Are queries diverse?
4. **Review TTL settings** - Are entries expiring too fast?

### High Memory Usage

If cache is using too much memory:

1. **Reduce L1 max entries**
2. **Run cache pruning regularly**
3. **Lower L2 max size**
4. **Consider shorter TTL**

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension (MCPClientManager)                    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Tool Call (semantic_query)                       │   │
│  │   ↓                                               │   │
│  │ logCacheInfo() - Extract cache metadata          │   │
│  │   ↓                                               │   │
│  │ Output: "💾 Cache HIT (L1) - Age: 125ms"         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  Cache Management:                                       │
│  • getCacheStats()  → cache_stats tool                  │
│  • warmCache()      → cache_warm tool                   │
│  • pruneCache()     → cache_prune tool                  │
└─────────────────────────────────────────────────────────┘
                           ↓ MCP Protocol
┌─────────────────────────────────────────────────────────┐
│ MCP Server (ast-mcp-server)                             │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Multi-Level Cache System                         │   │
│  │                                                   │   │
│  │  L1: Memory LRU (100 entries)                    │   │
│  │      ↓ Miss                                       │   │
│  │  L2: Disk Cache (10MB)                           │   │
│  │      ↓ Miss                                       │   │
│  │  L3: Database Cache (Persistent)                 │   │
│  │      ↓ Miss                                       │   │
│  │  Execute Query → Store in all levels             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  Response includes:                                      │
│  • cacheInfo { hit, level, age }                        │
│  • performanceMetrics { times }                         │
└─────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Monitor hit rates regularly** - Aim for > 50% for production
2. **Warm cache on startup** - Pre-load common queries
3. **Prune periodically** - Keep cache size manageable
4. **Use detailed stats for optimization** - Identify bottlenecks
5. **Test before deploying** - Verify cache behavior

## Related Documentation

- [DEVELOPMENT.md](../DEVELOPMENT.md) - Overall development guide
- [MANUAL_MCP_TESTING.md](../MANUAL_MCP_TESTING.md) - Manual testing procedures
- [Query Cache Implementation](../../packages/ast-helper/src/cache/query-cache.ts) - Cache source code
