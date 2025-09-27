# Migration from `pkg` to Modern Alternatives

## 🚨 Problem

The `pkg` package was deprecated and had security vulnerabilities that needed to be addressed.

## ✅ Solution

Migrated from `pkg` to a modern, secure approach using `@vercel/ncc` with shell wrappers.

### What Changed

**Before:**
- Used deprecated `pkg` package (v5.8.1)
- Had security vulnerabilities
- Generated true native executables

**After:**
- Uses `@vercel/ncc` (v0.38.1) - actively maintained by Vercel
- No security vulnerabilities  
- Creates bundled JavaScript with platform-specific wrapper scripts
- Smaller, faster builds
- Better compatibility with native Node.js modules

### New Build Process

1. **Bundle Creation**: `esbuild` creates an initial bundle
2. **Dependency Bundling**: `@vercel/ncc` creates a single-file bundle with all dependencies
3. **Wrapper Generation**: Platform-specific executable wrappers are created:
   - **Linux/macOS**: Shell script wrapper that finds Node.js and runs the bundle
   - **Windows**: CMD and PowerShell wrapper scripts

### Benefits

- ✅ **Security**: No vulnerabilities, actively maintained dependencies
- ✅ **Performance**: Faster build times, smaller bundles
- ✅ **Compatibility**: Better support for native modules and modern Node.js features
- ✅ **Maintenance**: Uses well-maintained, modern tooling
- ✅ **Flexibility**: Easier to debug and modify than binary executables

### Trade-offs

- **Requires Node.js**: Target systems need Node.js 20+ installed (documented in wrapper scripts)
- **Not True Binaries**: Creates bundled JavaScript with wrappers rather than native executables

### Usage

The build script usage remains the same:

```bash
# Build for all platforms
yarn run build:binaries

# Build for specific platform
yarn run build:binary:linux

# Build with options
npx tsx scripts/build/build-binaries.ts --platform linux --clean
```

### Generated Files

For each platform, the build creates:
- **Linux**: `ast-copilot-helper-linux-x64` (shell script) + `index.js` (bundle)
- **macOS**: `ast-copilot-helper-darwin-x64` (shell script) + `index.js` (bundle)  
- **Windows**: `ast-copilot-helper-win32-x64.cmd` + `ast-copilot-helper-win32-x64.ps1` + `ast-copilot-helper-win32-x64.js`

## 📦 Dependencies

**Removed:**
- `pkg@^5.8.1` (deprecated, vulnerable)

**Added:**
- `@vercel/ncc@^0.38.1` (modern, secure, actively maintained)

## 🔒 Security

All security vulnerabilities have been resolved. The new approach uses:
- Modern, actively maintained packages
- No known security issues
- Better dependency management
</(antml:parameter>
</invoke>