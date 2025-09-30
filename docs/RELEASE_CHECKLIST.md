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

### Option C: Manual Workflow

1. Go to [GitHub Actions](https://github.com/EvanDodds/ast-copilot-helper/actions)
2. Select "Release and Deployment" workflow
3. Click "Run workflow"
4. Enter version: `v1.2.3`
5. Choose environment: `production`

## Monitor Automation 👀

- [ ] [GitHub Actions workflow](https://github.com/EvanDodds/ast-copilot-helper/actions) completes successfully (10-15 min)
- [ ] [GitHub Release](https://github.com/EvanDodds/ast-copilot-helper/releases) created with binary assets
- [ ] NPM packages published: `npm view ast-copilot-helper@latest`
- [ ] No error notifications received

## Post-Release ✅

- [ ] Test binary downloads from GitHub release
- [ ] Verify npm package installation: `npm install -g ast-copilot-helper@latest`
- [ ] Update any external documentation if needed
- [ ] Announce release (optional)

## If Something Goes Wrong 🔧

1. Check [GitHub Actions logs](https://github.com/EvanDodds/ast-copilot-helper/actions) for specific errors
2. See [Common Release Issues](docs/development/release-process.md#common-release-issues--quick-fixes)
3. Re-run workflow if needed: `gh workflow run release.yml --ref main`
4. Contact maintainers if blocking issues occur

---

**Full Documentation**: [Release Process Guide](docs/development/release-process.md)
