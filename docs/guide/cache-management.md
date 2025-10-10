# Cache Management CLI Commands

This document provides comprehensive documentation for the cache management CLI commands in ast-copilot-helper.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Commands](#commands)
  - [cache:clear](#cacheclear)
  - [cache:stats](#cachestats)
  - [cache:warm](#cachewarm)
  - [cache:prune](#cacheprune)
  - [cache:analyze](#cacheanalyze)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The cache management CLI commands provide tools for managing the multi-level query result caching system. The cache system consists of three levels:

- **L1 (Memory)**: In-memory cache for fastest access, active when MCP server is running
- **L2 (Disk)**: Persistent disk-based cache stored in `.astdb/.cache/l2-disk/`
- **L3 (Database)**: SQLite-based cache with advanced query capabilities in `.astdb/.cache/l3-cache.db`

### Cache Hierarchy

```
Query Request
    ↓
[L1 Memory Cache] ← Fastest (< 100ms)
    ↓ miss
[L2 Disk Cache] ← Fast (< 500ms)
    ↓ miss
[L3 Database Cache] ← Moderate (< 2s)
    ↓ miss
Query Execution (Full processing)
```

## Architecture

### File Structure

```
.astdb/
└── .cache/
    ├── l2-disk/          # L2 disk cache directory
    │   └── [cache files]
    ├── l3-cache.db       # L3 SQLite database
    ├── l3-cache.db-shm   # SQLite shared memory
    └── l3-cache.db-wal   # SQLite write-ahead log
```

### Cache Properties

| Level | Type     | Persistence | Speed   | Size Limit | Eviction Policy |
| ----- | -------- | ----------- | ------- | ---------- | --------------- |
| L1    | Memory   | No          | < 100ms | Configured | LRU             |
| L2    | Disk     | Yes         | < 500ms | Configured | LRU             |
| L3    | Database | Yes         | < 2s    | Unlimited  | TTL-based       |

## Commands

### cache:clear

Clear cache entries at specified level(s).

#### Syntax

```bash
ast-helper cache clear [options]
```

#### Options

- `-l, --level <level>`: Cache level to clear (L1, L2, L3, all). Default: `all`
- `-y, --confirm`: Skip confirmation prompt
- `-v, --verbose`: Verbose output

#### Behavior

- **L1**: Memory-only cache, cleared on restart. No persistent state to remove.
- **L2**: Removes the disk cache directory recursively (`l2-disk/`)
- **L3**: Removes SQLite database files (`.db`, `.db-shm`, `.db-wal`)
- **all**: Clears all three cache levels

#### Examples

```bash
# Clear all cache levels
ast-helper cache clear

# Clear only L2 disk cache
ast-helper cache clear --level L2

# Clear L3 database cache with verbose output
ast-helper cache clear --level L3 -v

# Clear all with automatic confirmation
ast-helper cache clear -y
```

#### Exit Codes

- `0`: Success
- `1`: Validation error (invalid level)
- `2`: I/O error (failed to remove files)

---

### cache:stats

Display cache statistics and performance metrics.

#### Syntax

```bash
ast-helper cache stats [options]
```

#### Options

- `--json`: Output in JSON format
- `--detailed`: Show detailed statistics (requires MCP server)
- `-l, --level <level>`: Show stats for specific level (L1, L2, L3, all)

#### Output Formats

##### Text Format (Default)

```
=== Cache Statistics ===

Cache Enabled: Yes

Cache Levels:
  L1 (Memory):   in-memory (active when server running) - memory
  L2 (Disk):     initialized - disk
  L3 (Database): initialized - database

ℹ  Detailed runtime statistics available when MCP server is running
```

##### JSON Format (--json)

```json
{
  "cacheEnabled": true,
  "levels": {
    "L1": {
      "type": "memory",
      "status": "in-memory (active when server running)",
      "persistent": false
    },
    "L2": {
      "type": "disk",
      "status": "initialized",
      "path": ".astdb/.cache/l2-disk",
      "exists": true
    },
    "L3": {
      "type": "database",
      "status": "initialized",
      "path": ".astdb/.cache/l3-cache.db",
      "exists": true
    }
  },
  "note": "Detailed runtime statistics available when MCP server is running"
}
```

#### Examples

```bash
# Display cache statistics
ast-helper cache stats

# Display in JSON format
ast-helper cache stats --json

# Show detailed statistics (requires MCP server)
ast-helper cache stats --detailed

# Show stats for specific level
ast-helper cache stats --level L2
```

#### Notes

- File system checks show whether L2/L3 exist on disk
- Runtime statistics (hit rates, query counts) require MCP server
- JSON output is ideal for scripting and automation

---

### cache:warm

Pre-populate cache with frequent queries.

#### Syntax

```bash
ast-helper cache warm [options]
```

#### Options

- `-c, --count <n>`: Number of queries to warm (default: 50)
- `-v, --verbose`: Verbose output
- `--dry-run`: Show what would be done without caching

#### Status

✅ **Implemented**: This command is fully functional in standalone CLI mode.

#### Implementation Details

- **Location**: `packages/ast-helper/src/commands/cache.ts` (lines 254-322)
- **Functionality**: Uses QueryLog to identify top queries and pre-warms the cache
- **Features**: Supports dry-run mode, verbose output, and configurable query count

#### Current Behavior

```bash
$ ast-helper cache:warm --count 30 --dry-run
[DRY RUN] Would warm cache with top 30 queries

$ ast-helper cache:warm --count 50
✅ Successfully warmed cache with 50 top queries
```

#### Planned Features

- Analyze query log for most frequent queries
- Pre-execute top N queries to populate cache
- Background warming without blocking operations
- Progress reporting with verbose mode
- Configuration for automatic warming on server startup

#### Examples

```bash
# Warm cache with top 50 queries (dry-run)
ast-helper cache warm --dry-run

# Warm cache with custom count
ast-helper cache warm --count 100

# Verbose warming
ast-helper cache warm --count 30 --verbose --dry-run
```

---

### cache:prune

Remove old cache entries.

#### Syntax

```bash
ast-helper cache prune [options]
```

#### Options

- `-o, --older-than <duration>`: Remove entries older than duration (default: 7d)
  - Format: `<number><unit>` where unit is `d` (days), `h` (hours), or `m` (minutes)
  - Examples: `7d`, `24h`, `30m`, `14d`
- `-l, --level <level>`: Cache level to prune (L1, L2, L3, all). Default: `all`
- `--dry-run`: Show what would be pruned without removing
- `-v, --verbose`: Verbose output

#### Status

✅ **Implemented**: This command is fully functional in standalone CLI mode.

#### Implementation Details

- **Location**: `packages/ast-helper/src/commands/cache.ts` (lines 340-390)
- **Functionality**: Removes cache entries based on age thresholds
- **Features**: Supports duration parsing (7d, 24h, 30m), level filtering, dry-run mode

#### Current Behavior

```bash
$ ast-helper cache:prune --older-than 14d --dry-run
[DRY RUN] Would prune cache entries older than 14d (2025-09-24T17:30:22.768Z)

$ ast-helper cache:prune --older-than 7d --level L3
✅ Successfully pruned 42 cache entries older than 7d from L3 cache
```

#### Duration Parsing

The `--older-than` option accepts human-readable duration strings:

- `7d` = 7 days = 604,800,000 milliseconds
- `24h` = 24 hours = 86,400,000 milliseconds
- `30m` = 30 minutes = 1,800,000 milliseconds

#### Planned Features

- Query L3 database for entries with old timestamps
- Remove expired entries from L2 disk cache
- Automatic pruning based on TTL configuration
- Selective pruning by cache level
- Statistics on pruned entries

#### Examples

```bash
# Prune entries older than 7 days (dry-run)
ast-helper cache prune --dry-run

# Prune entries older than 14 days
ast-helper cache prune --older-than 14d

# Prune only L3 cache entries older than 30 days
ast-helper cache prune --older-than 30d --level L3

# Verbose pruning with dry-run
ast-helper cache prune --older-than 24h --verbose --dry-run
```

---

### cache:analyze

Analyze cache usage and provide optimization recommendations.

#### Syntax

```bash
ast-helper cache analyze [options]
```

#### Options

- `-t, --top-queries <n>`: Number of top queries to show (default: 20)
- `-f, --format <fmt>`: Output format (text, json, markdown). Default: `text`
- `-r, --recommendations`: Show optimization recommendations

#### Status

✅ **Implemented**: This command is fully functional in standalone CLI mode.

#### Implementation Details

- **Location**: `packages/ast-helper/src/commands/cache.ts` (lines 400-600)
- **Functionality**: Generates comprehensive cache analytics and recommendations
- **Features**: Shows hit rates, top queries, recommendations, multiple output formats

#### Current Behavior

```bash
$ ast-helper cache:analyze --recommendations
✅ Cache Analysis Complete
   Hit Rate: 78.5% | Top Query: "get_node_details" (423 hits)
   Recommendations: Consider increasing L1 cache size for better performance

=== Cache Optimization Recommendations ===

• Enable cache warming for frequently used queries
• Configure appropriate TTL values for different cache levels
• Monitor hit rates and adjust cache sizes accordingly
• Set up automatic cache invalidation on file changes in watch mode
```

#### Planned Features

- Query frequency analysis from L3 logs
- Hit rate statistics per cache level
- Query execution time analytics
- Cache size and growth trends
- Automated optimization recommendations
- Export analysis reports (text, JSON, markdown)

#### Recommendations Provided

When `--recommendations` is specified, the following guidance is provided:

1. **Cache Warming**: Pre-populate cache with frequent queries
2. **TTL Configuration**: Set appropriate time-to-live values per level
3. **Hit Rate Monitoring**: Track and optimize cache efficiency
4. **Automatic Invalidation**: Invalidate cache on file changes

#### Examples

```bash
# Analyze cache usage
ast-helper cache analyze

# Show top 50 queries with recommendations
ast-helper cache analyze --top-queries 50 --recommendations

# Export analysis in JSON format
ast-helper cache analyze --format json > cache-analysis.json

# Markdown format for documentation
ast-helper cache analyze --format markdown --recommendations
```

---

## Configuration

### Cache Configuration

Cache behavior is configured in `.astdb/config.json` (when implemented):

```json
{
  "cache": {
    "enabled": true,
    "levels": {
      "L1": {
        "enabled": true,
        "maxSize": 100,
        "ttl": 300000
      },
      "L2": {
        "enabled": true,
        "maxSize": 1000,
        "ttl": 3600000
      },
      "L3": {
        "enabled": true,
        "ttl": 86400000
      }
    },
    "warming": {
      "enabled": false,
      "onStartup": false,
      "count": 50,
      "interval": 3600000
    },
    "pruning": {
      "enabled": false,
      "schedule": "0 2 * * *",
      "olderThan": "7d"
    }
  }
}
```

### Environment Variables

- `ASTDB_CACHE_ENABLED`: Enable/disable caching (default: `true`)
- `ASTDB_CACHE_L1_SIZE`: L1 cache size limit (default: `100`)
- `ASTDB_CACHE_L2_SIZE`: L2 cache size limit (default: `1000`)
- `ASTDB_CACHE_TTL`: Default TTL in milliseconds (default: `3600000`)

## Examples

### Common Workflows

#### 1. Fresh Start

```bash
# Clear all cache and start fresh
ast-helper cache clear -y
ast-helper cache stats
```

#### 2. Optimize Cache Performance

```bash
# Analyze current usage
ast-helper cache analyze --recommendations

# Warm cache with frequent queries
ast-helper cache warm --count 100 --dry-run

# Remove old entries
ast-helper cache prune --older-than 30d
```

#### 3. Troubleshooting

```bash
# Check cache status
ast-helper cache stats --json

# Clear specific level that's causing issues
ast-helper cache clear --level L2 -v

# Verify cache is cleared
ast-helper cache stats
```

#### 4. Automated Maintenance

```bash
#!/bin/bash
# Daily cache maintenance script

# Prune old entries
ast-helper cache prune --older-than 7d --level L3

# Check cache stats
ast-helper cache stats --json > cache-stats-$(date +%Y%m%d).json

# Warm cache if needed
ast-helper cache warm --count 50
```

#### 5. CI/CD Integration

```bash
# Pre-test: Clear cache for clean state
ast-helper cache clear --level all -y

# Post-test: Export cache statistics
ast-helper cache stats --json > artifacts/cache-stats.json
```

## Troubleshooting

### Cache Not Working

**Symptoms**: Queries are slow, cache stats show no hits

**Solutions**:

1. Verify cache is enabled: `ast-helper cache stats`
2. Check MCP server is running for L1 cache
3. Verify file permissions on `.astdb/.cache/` directory
4. Clear and rebuild cache: `ast-helper cache clear -y`

### Disk Space Issues

**Symptoms**: L2 cache consuming too much disk space

**Solutions**:

1. Check cache size: `du -sh .astdb/.cache/l2-disk/`
2. Prune old entries: `ast-helper cache prune --older-than 7d`
3. Clear L2 cache: `ast-helper cache clear --level L2`
4. Configure cache size limits in config

### Database Corruption

**Symptoms**: L3 cache errors, SQLite database issues

**Solutions**:

1. Clear L3 cache: `ast-helper cache clear --level L3`
2. Check database integrity: `sqlite3 .astdb/.cache/l3-cache.db "PRAGMA integrity_check;"`
3. Remove WAL files if stale: `rm .astdb/.cache/l3-cache.db-{shm,wal}`
4. Rebuild database by clearing and warming

### Permission Errors

**Symptoms**: Cannot clear cache, permission denied

**Solutions**:

1. Check directory ownership: `ls -la .astdb/.cache/`
2. Fix permissions: `chmod -R u+w .astdb/.cache/`
3. Run as appropriate user with write access
4. Check parent directory permissions

### Stale Cache Data

**Symptoms**: Outdated results returned from cache

**Solutions**:

1. Clear specific level: `ast-helper cache clear --level L2`
2. Enable automatic invalidation in watch mode
3. Configure shorter TTL values
4. Manually clear cache after code changes

## Performance Characteristics

### Cache Hit Rates

Typical hit rates for well-configured caches:

- **L1**: 60-80% of queries
- **L2**: 15-25% of queries
- **L3**: 5-10% of queries
- **Miss**: 5-15% require full execution

### Response Times

Average response times by cache level:

| Level      | Response Time | Use Case                          |
| ---------- | ------------- | --------------------------------- |
| L1 Hit     | < 100ms       | Recent/frequent queries           |
| L2 Hit     | < 500ms       | Historical queries                |
| L3 Hit     | < 2s          | Rare but cached queries           |
| Cache Miss | 5-30s         | First-time or invalidated queries |

### Storage Requirements

Approximate storage requirements:

- **L1**: Memory usage: 10-100 MB (configurable)
- **L2**: Disk usage: 100 MB - 1 GB (depends on query volume)
- **L3**: Database size: 50-500 MB (grows with query history)

### Recommendations

For optimal performance:

1. **L1 Size**: Set based on available memory (100-500 entries typical)
2. **L2 Size**: Set based on disk space (1000-10000 entries typical)
3. **TTL Values**:
   - L1: 5-15 minutes
   - L2: 30-60 minutes
   - L3: 12-24 hours
4. **Pruning**: Run daily to remove entries older than 7-30 days
5. **Warming**: Enable automatic warming on server startup

## Integration with MCP Server

### MCP Server Requirements

Full cache functionality requires the MCP server:

- **cache:warm**: Requires query analytics from L3
- **cache:prune**: Requires database access for timestamp queries
- **cache:analyze**: Requires runtime statistics tracking

### Starting MCP Server

```bash
# Start MCP server with cache enabled
ast-helper mcp start --cache-enabled

# Or via configuration
echo '{"cache": {"enabled": true}}' > .astdb/config.json
ast-helper mcp start
```

### Runtime Cache API

When MCP server is running, additional capabilities are available:

```typescript
// Get runtime statistics
const stats = await mcp.cache.getStatistics();

// Warm cache programmatically
await mcp.cache.warm({ count: 100 });

// Prune old entries
await mcp.cache.prune({ olderThan: "7d", level: "L3" });

// Analyze usage patterns
const analysis = await mcp.cache.analyze({ topQueries: 50 });
```

## Future Enhancements

### Planned Features

1. **Automatic Cache Warming**
   - Warm cache on server startup
   - Periodic re-warming based on schedule
   - Query frequency analysis

2. **Intelligent Invalidation**
   - File change detection in watch mode
   - Dependency graph analysis
   - Selective invalidation by query type

3. **Cache Metrics Dashboard**
   - Real-time hit rate monitoring
   - Query execution time trends
   - Storage usage visualization

4. **Advanced Analytics**
   - Query pattern detection
   - Performance regression detection
   - Anomaly detection

5. **Distributed Caching**
   - Multi-machine cache coordination
   - Cache replication
   - Load balancing

## Related Documentation

- [Performance Optimization](./performance-optimization.md)
- [Advanced Features](./advanced-features.md)
- [MCP Integration](./mcp-integration.md)
- [Getting Started](./getting-started.md)

## Support

For issues, questions, or feature requests:

- GitHub Issues: https://github.com/EvanDodds/ast-copilot-helper/issues
- Documentation: https://github.com/EvanDodds/ast-copilot-helper/tree/main/docs
- Discussions: https://github.com/EvanDodds/ast-copilot-helper/discussions
