# AST Copilot Helper Distribution System

## Overview

The AST Copilot Helper Distribution System provides a comprehensive solution for packaging, distributing, and managing updates for the AST Copilot Helper extension and its components. The system supports multiple distribution channels including NPM registries, VS Code Marketplace, GitHub Releases, binary distribution, and automatic updates.

## Architecture

The distribution system is built around a modular publisher interface that enables different distribution channels to be implemented consistently:

```typescript
interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<any>;
  verify(result: any): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}
```

## Components

### 1. NPM Publisher (`NpmPublisher`)

Handles publication to NPM registries with support for:

- **Registry Support**: Public NPM registry, GitHub Package Registry, private registries
- **Authentication**: Token-based authentication with registry-specific configurations
- **Validation**: Package validation, version checks, dependency verification
- **Publishing**: Automated publishing with retry mechanisms and error handling
- **Verification**: Post-publication verification and health checks

**Key Features:**
- Multi-registry support with per-registry authentication
- Scoped package support (`@organization/package-name`)
- Version conflict detection and resolution
- Dependency vulnerability scanning
- Publishing metrics and analytics

### 2. VS Code Marketplace Publisher (`VsCodeMarketplacePublisher`)

Manages VS Code extension publishing with:

- **VSIX Packaging**: Automated extension packaging with asset optimization
- **Marketplace APIs**: Integration with Visual Studio Marketplace APIs
- **Authentication**: Azure DevOps token authentication
- **Validation**: Extension manifest validation, compatibility checks
- **Publishing**: Direct marketplace publishing with category and tag management
- **Verification**: Extension availability and installation verification

**Key Features:**
- Extension manifest validation
- Multi-target support (VS Code, VS Code Insiders, CodeOSS)
- Automated screenshot and README processing
- Extension analytics integration
- Pre-publication testing capabilities

### 3. GitHub Release Manager (`GitHubReleaseManager`)

Handles GitHub releases and asset management:

- **Release Creation**: Automated GitHub release creation with release notes
- **Asset Management**: Binary and documentation asset uploads
- **Tagging**: Git tag creation and management
- **Documentation**: Automated changelog and release notes generation
- **Verification**: Release asset integrity verification

**Key Features:**
- Multi-asset release support
- Release draft and pre-release capabilities
- Asset checksum generation and verification
- Integration with GitHub Actions workflows
- Release analytics and download tracking

### 4. Binary Distribution System (`BinaryDistributor`)

Provides cross-platform binary distribution:

- **Cross-Platform Packaging**: Windows (zip, msi), macOS (tar.gz, dmg), Linux (tar.gz, deb, rpm)
- **Code Signing**: Platform-specific code signing capabilities
- **Checksums**: SHA-256 checksum generation for all binaries
- **Verification**: Binary integrity and signature verification
- **Distribution**: CDN and direct download support

**Key Features:**
- Multi-format packaging (zip, tar.gz, deb, rpm, dmg, msi)
- Code signing for Windows (Authenticode), macOS (notarization), and Linux (GPG)
- Binary size optimization and compression
- Download server integration
- Platform-specific installer generation

### 5. Auto-Update Manager (`AutoUpdateManager`)

Handles automatic application updates:

- **Update Detection**: Server-based update checking with version comparison
- **Download Management**: Secure update package downloading with integrity verification
- **Installation**: Automated update installation with backup creation
- **Rollback System**: Automatic and manual rollback capabilities
- **User Interface**: User notification and consent management

**Key Features:**
- Configurable update channels (stable, beta, development)
- Background update downloading
- Silent and interactive update modes
- Rollback to previous versions
- Update server integration with CDN support

## Configuration

The system uses a comprehensive configuration structure:

```typescript
interface DistributionConfig {
  name: string;
  version: string;
  packages: PackageConfig[];
  registries: RegistryConfig[];
  platforms: Platform[];
  releaseNotes: string;
  marketplaces: MarketplaceConfig[];
  binaryDistribution: BinaryConfig;
  autoUpdate: AutoUpdateConfig;
  github: GitHubConfig;
  security: SecurityConfig;
}
```

### Sample Configuration

```typescript
const config: DistributionConfig = {
  name: "ast-copilot-helper",
  version: "1.0.0",
  packages: [
    {
      name: "@ast-copilot-helper/ast-helper",
      type: "npm",
      path: "./packages/ast-helper",
      publishConfig: {
        registry: "https://registry.npmjs.org",
        access: "public"
      }
    }
  ],
  registries: [
    {
      name: "npm",
      url: "https://registry.npmjs.org",
      auth: { token: process.env.NPM_TOKEN }
    }
  ],
  platforms: ["win32", "darwin", "linux"],
  marketplaces: [
    {
      name: "vscode-marketplace",
      publisherId: "your-publisher-id",
      auth: { token: process.env.VSCE_TOKEN }
    }
  ],
  github: {
    owner: "your-username",
    repo: "ast-copilot-helper",
    auth: { token: process.env.GITHUB_TOKEN }
  },
  binaryDistribution: {
    enabled: true,
    platforms: ["win32", "darwin", "linux"],
    formats: ["zip", "tar.gz", "deb", "rpm", "dmg"],
    signing: {
      enabled: true,
      certificates: {
        windows: process.env.WIN_CERT_PATH,
        macos: process.env.MACOS_CERT_PATH,
        linux: process.env.LINUX_GPG_KEY
      }
    }
  },
  autoUpdate: {
    enabled: true,
    server: {
      url: "https://your-update-server.com/api",
      channels: ["stable", "beta"]
    },
    client: {
      updateInterval: 24,
      channel: "stable",
      autoDownload: true,
      autoInstall: false,
      notifyUser: true
    },
    rollback: {
      enabled: true,
      autoRollback: false,
      maxVersionsToKeep: 3
    }
  }
};
```

## Usage

### Basic Distribution Workflow

```typescript
import { DistributionOrchestrator } from '@ast-copilot-helper/ast-helper';

async function distribute() {
  const orchestrator = new DistributionOrchestrator();
  
  // Initialize with configuration
  await orchestrator.initialize(config);
  
  // Validate all publishers
  const validation = await orchestrator.validateAll();
  if (!validation.success) {
    console.error('Validation failed:', validation.errors);
    return;
  }
  
  // Execute distribution
  const result = await orchestrator.distributeAll();
  if (result.success) {
    console.log('Distribution completed successfully');
  } else {
    console.error('Distribution failed:', result.error);
  }
}
```

### Individual Publisher Usage

```typescript
// NPM Publishing
const npmPublisher = new NpmPublisher();
await npmPublisher.initialize(config);
const npmResult = await npmPublisher.publish();

// VS Code Marketplace
const vsCodePublisher = new VsCodeMarketplacePublisher();
await vsCodePublisher.initialize(config);
const vsCodeResult = await vsCodePublisher.publish();

// GitHub Releases
const githubPublisher = new GitHubReleaseManager();
await githubPublisher.initialize(config);
const githubResult = await githubPublisher.publish();

// Binary Distribution
const binaryDistributor = new BinaryDistributor();
await binaryDistributor.initialize(config);
const binaryResult = await binaryDistributor.publish();

// Auto-Updates
const autoUpdateManager = new AutoUpdateManager();
await autoUpdateManager.initialize(config);
const updateResult = await autoUpdateManager.publish(); // Check for updates
```

## Security Features

The distribution system includes comprehensive security measures:

### Code Signing

- **Windows**: Authenticode signing with certificate validation
- **macOS**: Developer ID signing and notarization
- **Linux**: GPG signing for package repositories

### Integrity Verification

- SHA-256 checksums for all distributed assets
- Signature verification for signed packages
- Download integrity validation

### Authentication

- Secure token-based authentication for all services
- Environment variable configuration for sensitive credentials
- Multi-factor authentication support where available

### Supply Chain Security

- Dependency vulnerability scanning
- License compliance checking
- Automated security updates for dependencies

## CI/CD Integration

The distribution system integrates seamlessly with CI/CD pipelines:

### GitHub Actions

```yaml
name: Release Distribution
on:
  push:
    tags: ['v*']

jobs:
  distribute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build packages
        run: npm run build
        
      - name: Run distribution
        run: npm run distribute
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          VSCE_TOKEN: ${{ secrets.VSCE_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    environment {
        NPM_TOKEN = credentials('npm-token')
        VSCE_TOKEN = credentials('vsce-token')
        GITHUB_TOKEN = credentials('github-token')
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        
        stage('Distribute') {
            when {
                tag 'v*'
            }
            steps {
                sh 'npm run distribute'
            }
        }
    }
}
```

## Monitoring and Analytics

The distribution system provides comprehensive monitoring:

### Distribution Metrics

- Publication success/failure rates
- Distribution duration analytics
- Asset download statistics
- Error rate monitoring

### Update Analytics

- Update check frequency
- Update adoption rates
- Rollback frequency and reasons
- User interaction analytics

### Health Monitoring

- Service availability monitoring
- Performance metrics collection
- Alert integration for failures
- Dashboard integration support

## Error Handling and Recovery

Robust error handling with automatic recovery:

### Retry Mechanisms

- Exponential backoff for transient failures
- Configurable retry limits and timeouts
- Service-specific retry strategies

### Rollback Capabilities

- Automated rollback on critical failures
- Manual rollback commands
- Version history management
- Recovery verification

### Logging and Debugging

- Structured logging with correlation IDs
- Debug mode for detailed troubleshooting
- Error classification and categorization
- Integration with logging platforms

## Performance Optimization

The system is optimized for performance:

### Parallel Processing

- Concurrent publisher execution
- Parallel asset uploads
- Asynchronous validation

### Caching

- Asset caching for repeated operations
- Configuration caching
- Dependency resolution caching

### Compression

- Asset compression before upload
- Network transfer optimization
- Storage optimization

## Extensibility

The modular architecture supports easy extension:

### Custom Publishers

Implement the `Publisher` interface to add new distribution channels:

```typescript
class CustomPublisher implements Publisher {
  async initialize(config: DistributionConfig): Promise<void> {
    // Custom initialization logic
  }
  
  async validate(): Promise<ValidationResult> {
    // Custom validation logic
  }
  
  async publish(): Promise<CustomResult> {
    // Custom publishing logic
  }
  
  async verify(result: CustomResult): Promise<VerificationResult> {
    // Custom verification logic
  }
  
  async cleanup(): Promise<void> {
    // Custom cleanup logic
  }
}
```

### Plugin System

The system supports plugins for extended functionality:

```typescript
interface DistributionPlugin {
  name: string;
  version: string;
  beforePublish?(context: PublishContext): Promise<void>;
  afterPublish?(context: PublishContext, result: any): Promise<void>;
  onError?(error: Error, context: PublishContext): Promise<void>;
}
```

## Troubleshooting

Common issues and solutions:

### Authentication Failures

- Verify token validity and permissions
- Check token scope and expiration
- Validate service-specific requirements

### Upload Failures

- Check network connectivity
- Verify file permissions and sizes
- Review rate limiting constraints

### Version Conflicts

- Check existing published versions
- Verify semantic versioning compliance
- Review registry-specific requirements

### Update System Issues

- Verify update server connectivity
- Check client configuration
- Review rollback logs for errors

## Best Practices

### Security

- Use environment variables for sensitive credentials
- Implement least-privilege access principles
- Regularly rotate authentication tokens
- Enable audit logging for all operations

### Performance

- Use parallel processing where possible
- Implement proper caching strategies
- Monitor resource usage and optimize
- Use CDNs for asset distribution

### Reliability

- Implement comprehensive error handling
- Use retry mechanisms for transient failures
- Monitor system health and performance
- Maintain rollback capabilities

### Maintenance

- Regularly update dependencies
- Monitor security vulnerabilities
- Review and update configurations
- Test distribution workflows regularly

## API Reference

Detailed API documentation for all components is available in the `/docs/api/` directory:

- [NPM Publisher API](./api/npm-publisher.md)
- [VS Code Marketplace API](./api/vscode-marketplace.md)
- [GitHub Release Manager API](./api/github-release-manager.md)
- [Binary Distributor API](./api/binary-distributor.md)
- [Auto-Update Manager API](./api/auto-update-manager.md)
- [Configuration API](./api/configuration.md)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for information about contributing to the distribution system.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.