# Release Management Documentation

## Overview

The Release Management system provides comprehensive automation for software releases, including semantic versioning, changelog generation, backward compatibility checking, and multi-platform publishing.

## Quick Links

- **[Getting Started Guide](./getting-started.md)** - Installation and basic setup
- **[API Documentation](./API.md)** - Complete API reference and method documentation
- **[Usage Examples](./EXAMPLES.md)** - Real-world examples and use cases
- **[Developer Guide](./DEVELOPER.md)** - Extending and customizing the system
- **[Configuration Reference](./configuration.md)** - Complete configuration options
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions

## What's Included

### Core Features

- **Semantic Versioning**: Automated version calculation based on conventional commits
- **Changelog Generation**: Structured changelogs from commit history
- **Compatibility Checking**: Automated backward compatibility analysis
- **Multi-Platform Publishing**: Coordinate releases across npm, GitHub, Docker, and more
- **Rollback Management**: Automated rollback capabilities with health monitoring
- **Release Planning**: Comprehensive release planning and validation

### Advanced Features

- **Monorepo Support**: Coordinate releases across multiple packages
- **Prerelease Management**: Alpha, beta, and release candidate workflows
- **Custom Release Types**: Hotfix, security, and experimental releases
- **Plugin System**: Extensible architecture for custom functionality
- **CI/CD Integration**: Native support for GitHub Actions, GitLab CI, and more

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ComprehensiveReleaseManager                   │
│                         (Orchestrator)                          │
├─────────────────────────────────────────────────────────────────┤
│  VersionManager  │  ChangelogGen  │  CompatibilityChecker       │
├─────────────────────────────────────────────────────────────────┤
│  PlatformPublisher  │  RollbackManager  │  NotificationManager │
├─────────────────────────────────────────────────────────────────┤
│                     Core Interfaces & Types                     │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install @ast-copilot-helper/release-management
```

### Basic Usage

```typescript
import {
  ComprehensiveReleaseManager,
  ReleaseType,
} from "@ast-copilot-helper/release-management";

const manager = new ComprehensiveReleaseManager();
await manager.initialize(config);

// Plan and execute a release
const plan = await manager.planRelease("1.1.0", ReleaseType.MINOR);
const validation = await manager.validateRelease(plan);

if (validation.success) {
  const result = await manager.executeRelease(plan);
  console.log(
    `Release ${result.version} ${result.success ? "succeeded" : "failed"}`,
  );
}
```

## Configuration

Minimal configuration example:

```typescript
const config = {
  repository: {
    owner: "myorg",
    name: "myproject",
    defaultBranch: "main",
    releaseBranches: ["main"],
    protectedBranches: ["main"],
    monorepo: false,
  },
  versioning: {
    scheme: "semver",
    initialVersion: "1.0.0",
    channels: [],
    allowPrereleasePromotion: true,
    strictMode: true,
  },
  platforms: [
    {
      name: "npm",
      enabled: true,
      config: { registry: "https://registry.npmjs.org/", access: "public" },
      requirements: ["build", "test"],
      artifacts: ["dist/**", "package.json"],
    },
  ],
};
```

## Key Concepts

### Release Types

- **PATCH**: Bug fixes and small changes (0.0.1)
- **MINOR**: New features, backward compatible (0.1.0)
- **MAJOR**: Breaking changes (1.0.0)
- **PRERELEASE**: Alpha/beta releases (1.0.0-alpha.1)
- **HOTFIX**: Emergency fixes (1.0.1-hotfix.1)

### Release Workflow

1. **Planning**: Analyze changes and create release plan
2. **Validation**: Check compatibility and requirements
3. **Execution**: Build artifacts and prepare release
4. **Publishing**: Deploy to configured platforms
5. **Notification**: Send alerts and update documentation

### Platform Support

- **npm**: JavaScript packages
- **GitHub Releases**: Source code and binaries
- **Docker Hub**: Container images
- **VS Code Marketplace**: Extensions
- **Custom platforms**: Extensible plugin system

## Examples

### Automated Release

```typescript
// Detect changes and determine release type
const changes = await manager.generateChangelog("1.0.0", "HEAD");
const releaseType =
  changes.breakingChanges.length > 0 ? ReleaseType.MAJOR : ReleaseType.MINOR;

// Execute release
const plan = await manager.planRelease(null, releaseType); // Auto-calculate version
const result = await manager.executeRelease(plan);
```

### Prerelease Workflow

```typescript
// Create alpha
const alphaPlan = await manager.planRelease(
  "1.1.0-alpha.1",
  ReleaseType.PRERELEASE,
);
await manager.executeRelease(alphaPlan);

// Promote to stable
const stablePlan = await manager.planRelease("1.1.0", ReleaseType.MINOR);
await manager.executeRelease(stablePlan);
```

### Rollback

```typescript
// Automatic rollback on failure
const result = await manager.executeRelease(plan);
if (!result.success && config.rollback.enabled) {
  const rollback = await manager.rollbackRelease(plan.version, result.error);
  console.log(`Rolled back to ${rollback.rolledBackVersion}`);
}
```

## Integration

### GitHub Actions

```yaml
- name: Release Management
  run: node scripts/release.js
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### VS Code Extension

```typescript
// Register commands
vscode.commands.registerCommand("extension.release", async () => {
  const manager = new ComprehensiveReleaseManager();
  // ... release logic
});
```

## Best Practices

1. **Use Conventional Commits**: Enable automated changelog generation
2. **Test Release Plans**: Always validate before execution
3. **Monitor Health**: Set up post-release monitoring
4. **Backup Strategy**: Maintain rollback procedures
5. **Documentation**: Keep release notes up-to-date

## Migration

### From Manual Releases

1. Install the release management system
2. Configure basic settings (repository, versioning)
3. Set up platform configurations
4. Test with a patch release
5. Gradually add advanced features

### From Other Tools

The system provides migration utilities for:

- `semantic-release`
- `standard-version`
- `np`
- Custom release scripts

## Contributing

We welcome contributions! Please see our [Developer Guide](./DEVELOPER.md) for:

- Architecture overview
- Extending the system
- Adding custom platforms
- Writing plugins
- Testing strategies

## Support

- **Documentation**: Complete guides and API reference
- **Examples**: Real-world usage patterns
- **Troubleshooting**: Common issues and solutions
- **Community**: GitHub discussions and issues

## License

This project is licensed under the MIT License - see the [LICENSE](../../../LICENSE) file for details.

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for release history and breaking changes.
