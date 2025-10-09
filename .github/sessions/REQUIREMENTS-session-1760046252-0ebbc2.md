# Requirements Extraction & Organization

## Session: session-1760046252-0ebbc2

## Date: 2025-10-09

## Issues: #169, #170, #171

---

## Master Acceptance Criteria Checklist

### Priority 1: Configuration Foundation (Issues #170, #171)

These issues share the config system and should be implemented together.

#### Issue #170: MCP Server Configuration (2-3 hours)

**Priority:** HIGH (Foundation for #171)  
**Dependencies:** None  
**Files:** `config/schema.ts`, `config/manager.ts`, `examples/config.json`

**Acceptance Criteria:**

1. ✅ **AC-170-1:** Add `mcp` section to ConfigSchema with TypeScript types
   - Property: `port` (number, default: 3000)
   - Property: `autoStart` (boolean, default: false)
   - Validation: port range 1024-65535

2. ✅ **AC-170-2:** Support `port` configuration with validation
   - Validate port is valid number
   - Validate port is in acceptable range
   - Error handling for invalid ports

3. ✅ **AC-170-3:** Support `autoStart` flag for VS Code extension integration
   - Boolean flag in config
   - Default to false for safety
   - Document usage in schema

4. ✅ **AC-170-4:** Update example config.json file with MCP section
   - Add commented example
   - Show default values
   - Include usage documentation

5. ✅ **AC-170-5:** Add tests for MCP config validation
   - Valid config passes
   - Invalid port fails
   - Missing section uses defaults
   - Type validation tests

6. ✅ **AC-170-6:** Document MCP configuration options
   - Update README.md
   - Add to configuration guide
   - Include examples and use cases

---

#### Issue #171: XDG Base Directory & User Config (2-4 hours)

**Priority:** HIGH (Builds on #170)  
**Dependencies:** Issue #170 (config schema must exist)  
**Files:** `config/manager.ts`, `config/xdg-paths.ts` (new), `cli.ts`, README

**Acceptance Criteria:**

1. ✅ **AC-171-1:** Implement XDG Base Directory path resolution module
   - Create `config/xdg-paths.ts`
   - Support `$XDG_CONFIG_HOME` env variable
   - Fallback to `~/.config` if not set
   - Platform detection (Linux/macOS vs Windows)

2. ✅ **AC-171-2:** Support `$XDG_CONFIG_HOME/.config/ast-copilot-helper/config.json`
   - Resolve XDG paths correctly
   - Handle missing directories gracefully
   - Cross-platform compatibility

3. ✅ **AC-171-3:** Add config file discovery hierarchy
   - **Priority 1:** `--config` flag (explicit path)
   - **Priority 2:** `--user-config` flag (XDG user config)
   - **Priority 3:** Workspace `.astdb/config.json`
   - **Priority 4:** User config `$XDG_CONFIG_HOME/.config/ast-copilot-helper/config.json`
   - **Priority 5:** Default embedded config
   - First found wins

4. ✅ **AC-171-4:** Add `--user-config` CLI flag
   - Boolean flag to use user config
   - Resolves to XDG path automatically
   - Works with all commands
   - Documented in help text

5. ✅ **AC-171-5:** Add tests for config discovery hierarchy
   - Test each priority level
   - Test fallback behavior
   - Test XDG path resolution
   - Test flag combinations
   - Mock file system appropriately

6. ✅ **AC-171-6:** Document user config in README
   - Add "User Configuration" section
   - Explain XDG Base Directory support
   - Show discovery hierarchy
   - Provide examples
   - Document `--user-config` flag

---

### Priority 2: HNSW Robustness (Issue #169)

Independent implementation that can proceed in parallel or after config work.

#### Issue #169: HNSW Index Corruption Detection (6-8 hours)

**Priority:** MEDIUM (Independent, can be done last)  
**Dependencies:** None  
**Files:** `database/vector/hnsw-database.ts`, `database/vector/types.ts`, `database/vector/corruption-detector.ts` (new)

**Acceptance Criteria:**

1. ✅ **AC-169-1:** Add metadata file with index checksum tracking
   - Create `corruption-detector.ts` module
   - Compute SHA-256 checksum of HNSW index on save
   - Store checksum in metadata file (e.g., `.astdb/index.meta.json`)
   - Include version, dimensions, vector count, build timestamp

2. ✅ **AC-169-2:** Implement checksum verification on index load
   - Verify checksum on database initialization
   - Compare stored checksum with computed checksum
   - Detect mismatches (corruption indicator)
   - Log verification results

3. ✅ **AC-169-3:** Auto-detect corruption and prompt for rebuild
   - On checksum mismatch, prompt user
   - Provide clear error message
   - Offer automatic rebuild option
   - Non-blocking for automation (flag support)

4. ✅ **AC-169-4:** Provide `--rebuild-index` CLI command
   - Add `rebuild-index` command to CLI
   - Triggers manual index rebuild
   - Works with or without corruption
   - Shows progress and completion status

5. ✅ **AC-169-5:** Add corruption detection tests
   - Test checksum computation
   - Test verification logic
   - Test corruption detection (simulated)
   - Test rebuild trigger
   - Integration tests for full flow

6. ✅ **AC-169-6:** Document rebuild process in user guide
   - Add "Index Maintenance" section
   - Explain corruption detection
   - Document rebuild command
   - Provide troubleshooting guide

7. ✅ **AC-169-7:** Ensure rebuild preserves SQLite storage integrity
   - Rebuild only affects HNSW index
   - SQLite vectors remain untouched
   - Metadata preserved during rebuild
   - Verify data integrity after rebuild

---

## Implementation Dependencies

```
Issue #170 (MCP Config)
    ↓ (schema foundation)
Issue #171 (XDG Paths)

Issue #169 (HNSW Corruption) - Independent
```

**Recommended Order:**

1. Issue #170 → Config schema with MCP section
2. Issue #171 → XDG paths (uses schema from #170)
3. Issue #169 → HNSW corruption detection (independent)

---

## Testing Requirements

### Unit Tests

- **Issue #170:** 5-8 tests (config validation, schema, defaults)
- **Issue #171:** 8-12 tests (XDG resolution, hierarchy, flags)
- **Issue #169:** 10-15 tests (checksum, detection, rebuild)

**Total:** ~25-35 new unit tests

### Integration Tests

- **Issue #171:** Config discovery end-to-end (2-3 tests)
- **Issue #169:** Corruption detection + rebuild flow (2-3 tests)

**Total:** ~5-6 integration tests

### Manual Testing

- Verify config discovery on different platforms
- Test MCP config with real MCP server
- Simulate index corruption and verify rebuild

---

## Success Criteria

### Issue #170: MCP Config

- ✅ MCP section in schema with proper types
- ✅ Port validation working (1024-65535)
- ✅ autoStart flag functional
- ✅ Example config updated
- ✅ Tests passing (100% coverage for new code)
- ✅ Documentation complete

### Issue #171: XDG Paths

- ✅ XDG path resolution working on Linux/macOS
- ✅ Config discovery hierarchy functional
- ✅ `--user-config` flag working
- ✅ Tests passing (100% coverage)
- ✅ Cross-platform compatibility verified
- ✅ Documentation complete

### Issue #169: HNSW Corruption

- ✅ Checksum computation accurate and fast
- ✅ Corruption detection reliable
- ✅ Rebuild command functional
- ✅ SQLite integrity preserved
- ✅ Tests passing (100% coverage)
- ✅ User documentation complete

---

## Risk Assessment

### Low Risk

- **Issue #170:** Simple schema addition, well-defined scope
- **Issue #171:** XDG standard is well-documented, low complexity

### Medium Risk

- **Issue #169:** Checksum validation adds performance overhead
  - **Mitigation:** Async checksum computation, cache results
  - **Mitigation:** Skip verification in development mode

### Dependencies

- No external library dependencies needed
- All work uses existing infrastructure
- Node.js crypto module sufficient for checksums

---

## Total Estimated Effort

- **Issue #170:** 2-3 hours
- **Issue #171:** 2-4 hours
- **Issue #169:** 6-8 hours
- **Testing & Documentation:** 2-3 hours

**Total:** 12-18 hours (1.5-2 days focused work)

---

## Next Steps

1. ✅ Requirements extracted and organized
2. → Create detailed implementation plan (Step 3)
3. → Begin implementation with Issue #170
4. → Implement Issue #171
5. → Implement Issue #169
6. → Comprehensive testing and validation
7. → Mark PR ready for review

---

**Status:** ✅ Requirements extraction complete  
**Ready for:** Step 3 - Implementation Planning
