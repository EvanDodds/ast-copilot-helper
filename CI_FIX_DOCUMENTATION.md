# CI Test Failure Fix: MCP Resources Backward Compatibility

## Issue

CI tests were failing with errors like:

```
AssertionError: Target cannot be null or undefined.
❯ tests/unit/mcp/resources.test.ts:246:31
  244|         const content = JSON.parse(response.result.contents[0].text);
  245|         expect(content.filePath).toBe("/test/file.ts");
  246|         expect(content.nodes).toHaveLength(1);
       |                               ^
  247|         expect(content.totalCount).toBe(1);
```

## Root Cause

The CI was running an older version of the tests that expected the legacy flat format:

- `content.nodes` (instead of `content.structure.rootNodes`)
- `content.totalCount` (instead of `content.structure.totalNodes`)
- `content.matches` (instead of `content.results.matches`)

## Solution

Added backward compatibility properties to MCP resource responses by:

1. **Updated TypeScript interfaces** to include both new and legacy properties:
   - `FileResourceContent`: Added `nodes` and `totalCount` properties
   - `SearchResourceContent`: Added `matches` and `totalCount` properties

2. **Modified resource handlers** to return both formats:
   - File resources: Return both `structure.rootNodes` and `nodes` (same data)
   - Search resources: Return both `results.matches` and `matches` (same data)
   - Both formats contain identical data for full compatibility

3. **Ensured data consistency** between new and legacy formats:
   - `structure.rootNodes` === `nodes`
   - `structure.totalNodes` === `totalCount`
   - `results.matches` === `matches`
   - `results.totalCount` === `totalCount`

## Files Modified

- `packages/ast-mcp-server/src/mcp/resources.ts`
  - Updated interfaces for backward compatibility
  - Modified `handleFilesResource()` to return both formats
  - Modified `handleSearchResource()` to return both formats

## Verification

- ✅ All local tests pass with new format expectations
- ✅ Backward compatibility verified with test script
- ✅ Both old and new format properties contain same data
- ✅ No breaking changes to existing API

## Impact

- **Zero breaking changes** - existing consumers continue to work
- **Future-proof** - new consumers can use structured format
- **Gradual migration** - consumers can migrate at their own pace

The fix ensures that both the old flat format and new structured format are available simultaneously, allowing for a smooth transition.
