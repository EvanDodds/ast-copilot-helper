# Release Checklist

> **Quick Reference for Maintainers**

## Pre-Release ✅

- [ ] All changes merged to `main` branch
- [ ] CI checks passing (green checkmarks on latest commit)
- [ ] No critical issues or security vulnerabilities
- [ ] Version follows semantic versioning (major.minor.patch)

## Create Release 🚀

Choose one method:

### Option A: Tag Push (Recommended)

```bash
git checkout main
git pull origin main
git tag v1.2.3           # Replace with your version
git push origin v1.2.3
```

### Option B: GitHub Release

1. Go to [GitHub Releases](https://github.com/EvanDodds/ast-copilot-helper/releases)
2. Click "Create a new release"
3. Enter tag: `v1.2.3` (creates tag automatically)
4. Add title: "AST Copilot Helper v1.2.3"
5. Click "Publish release"

### Option C: Manual Workflow (Enhanced)

1. Go to [GitHub Actions](https://github.com/EvanDodds/ast-copilot-helper/actions)
2. Select "Release Pipeline" workflow
3. Click "Run workflow"
4. **Configure release options**:
   - **Version**: `v1.2.3`
   - **Channels**: Choose distribution scope
     - `all` (default) - Complete release
     - `npm-only` - Only npm publishing
     - `binaries-only` - Only executable builds
     - `github-only` - Only GitHub release
     - `docker-only` - Only Docker images
   - **Environment**: `staging` or `production`
   - **Dry run**: Check for validation-only (no publishing)

## Monitor Automation 👀

- [ ] ["Release Pipeline" workflow](https://github.com/EvanDodds/ast-copilot-helper/actions) completes successfully (10-15 min)
- [ ] [GitHub Release](https://github.com/EvanDodds/ast-copilot-helper/releases) created with binary assets
- [ ] NPM packages published: `npm view ast-copilot-helper@latest`
- [ ] Docker images available: `docker pull ghcr.io/evandodds/ast-copilot-helper:latest`
- [ ] All binaries are real executables (not scripts)
- [ ] No error notifications received

## Post-Release ✅

- [ ] Test binary downloads from GitHub release
- [ ] Verify npm package installation: `npm install -g ast-copilot-helper@latest`
- [ ] Verify binaries are real executables: `file ast-copilot-helper-*` (should show "ELF" or "Mach-O", not "ASCII text")
- [ ] Check Docker image: `docker run --rm ghcr.io/evandodds/ast-copilot-helper:latest --help`
- [ ] Verify faster release time (~8-12 min vs previous 15-20 min)
- [ ] Update any external documentation if needed
- [ ] Announce release (optional)

## ✨ Unified Pipeline Benefits

**Improvements you should notice:**

- ⚡ **Faster releases**: 40% faster completion (no redundant testing)
- 💰 **Lower resource usage**: 75% reduction in CI consumption
- 🎯 **Simpler monitoring**: Single workflow to watch
- 🛠️ **Better recovery**: Channel-specific re-runs available
- 📊 **Enhanced visibility**: Real-time progress across all phases

## If Something Goes Wrong 🔧

1. Check [GitHub Actions logs](https://github.com/EvanDodds/ast-copilot-helper/actions) for specific errors
2. See [Common Release Issues](docs/development/release-process.md#common-release-issues--quick-fixes)
3. **Re-run options**:
   - Full re-run: `gh workflow run release-pipeline.yml --ref main`
   - Specific channel: Use manual dispatch with channel selection
   - Dry run first: Use manual dispatch with "dry run" checked
4. Contact maintainers if blocking issues occur

---

**Full Documentation**: [Release Process Guide](docs/development/release-process.md)
