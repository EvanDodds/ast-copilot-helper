# Repository Snapshot Distribution System

**Part of Issue #161**

## Overview

The Repository Snapshot Distribution System enables teams to share pre-built `.astdb` directories, dramatically reducing onboarding time from hours to minutes. Instead of parsing entire codebases, new team members or CI environments can download and restore complete snapshots.

### Benefits

- **Faster Onboarding**: Reduce setup from hours to minutes
- **CI/CD Optimization**: Skip parsing in every pipeline run
- **Team Collaboration**: Share identical database states
- **Version Control**: Track snapshots with semantic versioning
- **Remote Storage**: Distribute via GitHub Releases or custom backends

### Quick Start

```bash
# Create a snapshot
yarn ast-helper snapshot create --version 1.0.0 --description "Production snapshot"

# Publish to GitHub Releases
yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz

# On another machine, download and restore
yarn ast-helper snapshot download 1.0.0
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz
```

## Architecture

### Components

1. **SnapshotCreator**: Creates compressed snapshots with metadata
2. **SnapshotRestorer**: Restores snapshots with validation and backup
3. **SnapshotManager**: Orchestrates all snapshot operations
4. **RemoteStorage**: Interface for remote backends (GitHub, S3, etc.)
5. **GitHubStorage**: GitHub Releases backend implementation
6. **CLI Commands**: User-friendly command-line interface

### Data Flow

```
Local .astdb Directory
    ↓
SnapshotCreator (compress + metadata)
    ↓
Snapshot File (.tar.gz)
    ↓
RemoteStorage (upload)
    ↓
GitHub Releases
    ↓
RemoteStorage (download)
    ↓
Snapshot File (.tar.gz)
    ↓
SnapshotRestorer (decompress + validate)
    ↓
Restored .astdb Directory
```

## CLI Commands

### `snapshot create`

Create a new snapshot from an existing `.astdb` directory.

**Usage:**

```bash
yarn ast-helper snapshot create [options]
```

**Options:**

- `--version <version>`: Semantic version (e.g., "1.0.0")
- `--description <text>`: Human-readable description
- `--tags <tags>`: Comma-separated tags (e.g., "production,v1.0")
- `--compression <0-9>`: Compression level (default: 6)
- `--include-models`: Include model files (increases size)
- `--include-cache`: Include cache files (usually excluded)
- `--include-logs`: Include log files (usually excluded)
- `--output <path>`: Output file path
- `--verbose`: Show detailed progress

**Examples:**

```bash
# Basic snapshot
yarn ast-helper snapshot create --version 1.0.0

# Production snapshot with tags
yarn ast-helper snapshot create \
  --version 1.0.0 \
  --description "Production release" \
  --tags "production,stable,v1.0"

# High compression without models
yarn ast-helper snapshot create \
  --version 1.0.0 \
  --compression 9 \
  --no-include-models

# Custom output path
yarn ast-helper snapshot create \
  --version 1.0.0 \
  --output ./snapshots/custom.tar.gz
```

**Output:**

```
📦 Creating snapshot...
  Phase: Collecting files
  Progress: 45% (120/267 files)

✅ Snapshot created successfully!
   Path: .snapshots/snapshot-1.0.0-abc123.tar.gz
   Version: 1.0.0
   Size: 45.2 MB (compressed from 123.4 MB)
   Compression ratio: 36.6%
   Checksum: a1b2c3d4...
   Files: 267
   Repository: https://github.com/example/repo
   Commit: abc123def456
```

### `snapshot restore`

Restore a snapshot to a target `.astdb` directory.

**Usage:**

```bash
yarn ast-helper snapshot restore <snapshot-path> [options]
```

**Options:**

- `--target <path>`: Target directory (default: ./.astdb)
- `--backup`: Create backup before restoring (recommended)
- `--skip-checksum`: Skip checksum validation
- `--force`: Overwrite existing files without confirmation
- `--skip-models`: Don't restore model files
- `--verbose`: Show detailed progress

**Examples:**

```bash
# Basic restore
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz

# Restore with backup
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz --backup

# Restore to custom location
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz \
  --target ./my-astdb

# Skip models for faster restore
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz \
  --skip-models
```

**Output:**

```
📥 Restoring snapshot...
  Phase: Validating checksum
  Progress: 25%

  Phase: Creating backup
  Backup: .astdb.backup.20231008-152301

  Phase: Extracting files
  Progress: 75% (200/267 files)

✅ Snapshot restored successfully!
   Target: ./.astdb
   Files restored: 267
   Duration: 12.3s
   Backup: .astdb.backup.20231008-152301
```

### `snapshot list`

List available snapshots (local and/or remote).

**Usage:**

```bash
yarn ast-helper snapshot list [options]
```

**Options:**

- `--location <local|remote|all>`: Filter by location (default: all)
- `--tags <tags>`: Filter by tags (comma-separated)
- `--sort-by <created|version|size>`: Sort order (default: created)
- `--order <asc|desc>`: Sort direction (default: desc)
- `--json`: Output as JSON
- `--verbose`: Show detailed information

**Examples:**

```bash
# List all snapshots
yarn ast-helper snapshot list

# List only local snapshots
yarn ast-helper snapshot list --location local

# List only remote snapshots
yarn ast-helper snapshot list --location remote

# Filter by tags
yarn ast-helper snapshot list --tags production,stable

# Sort by size
yarn ast-helper snapshot list --sort-by size --order desc

# JSON output for scripting
yarn ast-helper snapshot list --json
```

**Output (Verbose):**

```
📦 Local Snapshots (2):

1. snapshot-1.0.0-abc123.tar.gz
   Version: 1.0.0
   Created: 2023-10-08 15:23:01
   Size: 45.2 MB
   Tags: production, stable, v1.0
   Files: 267
   Checksum: a1b2c3d4...

2. snapshot-0.9.0-def456.tar.gz
   Version: 0.9.0
   Created: 2023-10-01 10:15:32
   Size: 42.1 MB
   Tags: beta, testing
   Files: 251

🌐 Remote Snapshots (3):

1. 1.0.0
   Version: 1.0.0
   Created: 2023-10-08 15:30:45
   Size: 45.2 MB
   Tags: production, stable
   URL: https://github.com/example/repo/releases/download/...
```

### `snapshot publish`

Publish a local snapshot to remote storage.

**Usage:**

```bash
yarn ast-helper snapshot publish <snapshot-path> [options]
```

**Options:**

- `--remote <index>`: Remote storage index (default: 0)
- `--verbose`: Show upload progress

**Examples:**

```bash
# Publish to default remote
yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz

# Publish to specific remote
yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz --remote 1
```

**Output:**

```
📤 Publishing snapshot to GitHub Releases...
  Uploading: 45.2 MB
  Progress: 75%

✅ Snapshot published successfully!
   Remote ID: 1.0.0
   URL: https://github.com/example/repo/releases/download/snapshots/snapshot-1.0.0.tar.gz
   Size: 45.2 MB
```

### `snapshot download`

Download a snapshot from remote storage.

**Usage:**

```bash
yarn ast-helper snapshot download <remote-id> [options]
```

**Options:**

- `--remote <index>`: Remote storage index (default: 0)
- `--output <path>`: Output directory (default: ./.snapshots)
- `--verbose`: Show download progress

**Examples:**

```bash
# Download by version
yarn ast-helper snapshot download 1.0.0

# Download to custom location
yarn ast-helper snapshot download 1.0.0 \
  --output ./my-snapshots
```

**Output:**

```
📥 Downloading snapshot from GitHub Releases...
  Downloading: 45.2 MB
  Progress: 60%

✅ Snapshot downloaded successfully!
   Local path: .snapshots/snapshot-1.0.0.tar.gz
   Size: 45.2 MB

💡 To restore: yarn ast-helper snapshot restore .snapshots/snapshot-1.0.0.tar.gz
```

### `snapshot delete`

Delete a snapshot (local or remote).

**Usage:**

```bash
yarn ast-helper snapshot delete <identifier> [options]
```

**Options:**

- `--location <local|remote>`: Where to delete from
- `--confirm`: Skip confirmation prompt
- `--verbose`: Show detailed progress

**Examples:**

```bash
# Delete local snapshot
yarn ast-helper snapshot delete snapshot-1.0.0.tar.gz \
  --location local

# Delete remote snapshot
yarn ast-helper snapshot delete 1.0.0 \
  --location remote \
  --confirm
```

**Output:**

```
🗑️  Deleting snapshot...
⚠️  Warning: This action cannot be undone!
✅ Snapshot deleted successfully
```

## Team Collaboration Workflows

### 1. Onboarding New Developers

**Problem**: New developers spend hours parsing large codebases.

**Solution**: Share pre-built snapshots.

```bash
# Team lead creates and publishes snapshot
yarn ast-helper init
yarn ast-helper parse
yarn ast-helper snapshot create --version 1.0.0 --description "Onboarding snapshot"
yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz

# New developer downloads and restores
yarn ast-helper snapshot download 1.0.0
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz
# Ready to work in minutes!
```

### 2. CI/CD Pipeline Optimization

**Problem**: Every CI run parses the entire codebase, wasting time.

**Solution**: Use automated snapshots in CI.

```yaml
# .github/workflows/test.yml
- name: Restore snapshot
  run: |
    yarn ast-helper snapshot download latest
    yarn ast-helper snapshot restore snapshot-latest.tar.gz

- name: Run tests
  run: yarn test
```

### 3. Release Snapshots

**Problem**: Need reproducible database states for each release.

**Solution**: Create tagged snapshots for releases.

```bash
# During release
yarn ast-helper snapshot create \
  --version 1.0.0 \
  --description "Release 1.0.0" \
  --tags "production,release,v1.0"

yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz
```

### 4. Team Synchronization

**Problem**: Team members have different database states.

**Solution**: Share daily snapshots.

```bash
# Automated daily snapshot (see CI/CD Automation below)
# Team members sync daily:
yarn ast-helper snapshot download nightly-20231008
yarn ast-helper snapshot restore snapshot-nightly-20231008.tar.gz
```

## GitHub Storage Configuration

### Setup

1. **Create GitHub Personal Access Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Create token with `repo` scope
   - Copy token for next step

2. **Configure Environment Variables**

   ```bash
   export GITHUB_TOKEN="ghp_your_token_here"
   export GITHUB_OWNER="your-username-or-org"
   export GITHUB_REPO="your-repo-name"
   export GITHUB_RELEASE_TAG="snapshots"  # Optional, defaults to "snapshots"
   ```

3. **Verify Configuration**
   ```bash
   yarn ast-helper snapshot list --location remote
   ```

### CI/CD Configuration

In GitHub Actions, the token is automatically available:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  GITHUB_OWNER: ${{ github.repository_owner }}
  GITHUB_REPO: ${{ github.event.repository.name }}
```

### Permissions

The GitHub token needs:

- `contents:write` - Create releases and upload assets
- `repos` - Access repository metadata

## CI/CD Automation

The snapshot system includes a GitHub Actions workflow for automated snapshot creation.

### Workflow File

`.github/workflows/snapshot-automation.yml`

### Triggers

1. **Push to Main**: Creates snapshot after code changes
2. **Release**: Creates tagged snapshot for releases
3. **Nightly Schedule**: Creates daily snapshots at 2 AM UTC
4. **Manual Dispatch**: Create snapshots on demand

### Manual Trigger

```bash
# Via GitHub CLI
gh workflow run snapshot-automation.yml \
  -f snapshot_version=1.0.0 \
  -f snapshot_description="Manual snapshot" \
  -f publish_to_release=true

# Via GitHub UI
Actions → Snapshot Automation → Run workflow
```

### Workflow Steps

1. Checkout repository
2. Install dependencies
3. Build project
4. Initialize .astdb
5. Parse repository
6. Generate annotations
7. Create snapshot
8. Publish to GitHub Releases
9. Upload as workflow artifact
10. Cleanup old snapshots (nightly only)

### Artifact Retention

- Workflow artifacts: 30 days
- Nightly snapshots: 7 days
- Release snapshots: Permanent

## Snapshot Metadata

Each snapshot includes comprehensive metadata:

```json
{
  "id": "1.0.0-abc123",
  "version": "1.0.0",
  "createdAt": "2023-10-08T15:23:01.234Z",
  "repository": {
    "url": "https://github.com/example/repo",
    "commitSha": "abc123def456",
    "branch": "main",
    "fileCount": 267
  },
  "size": {
    "uncompressed": 129458176,
    "compressed": 47431680,
    "ratio": 0.366
  },
  "toolVersion": "1.0.0",
  "schemaVersion": "1.0",
  "contents": {
    "databases": ["index.astdb"],
    "annotationCount": 1234,
    "astCount": 567,
    "grammars": ["typescript", "python"],
    "models": []
  },
  "description": "Production snapshot",
  "tags": ["production", "stable", "v1.0"],
  "creator": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "checksum": "a1b2c3d4e5f6..."
}
```

## Troubleshooting

### Snapshot Creation Fails

**Error**: `Source directory does not exist`

**Solution**: Ensure `.astdb` directory exists:

```bash
yarn ast-helper init
yarn ast-helper parse
```

**Error**: `Insufficient disk space`

**Solution**: Free up disk space or use higher compression:

```bash
yarn ast-helper snapshot create --compression 9
```

### Restore Fails

**Error**: `Checksum validation failed`

**Solution**: Re-download snapshot or skip validation:

```bash
yarn ast-helper snapshot download 1.0.0
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz --skip-checksum
```

**Error**: `Target directory not empty`

**Solution**: Use `--force` or manually clean:

```bash
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz --force
```

### GitHub Upload Fails

**Error**: `Unauthorized (401)`

**Solution**: Check GitHub token:

```bash
echo $GITHUB_TOKEN  # Should show token
# If empty, set environment variables (see Setup)
```

**Error**: `Release not found (404)`

**Solution**: Create release manually or enable auto-creation:

```bash
# Manual release creation
gh release create snapshots --title "Snapshots" --notes "Automated snapshots"
```

### Large Snapshot Size

**Problem**: Snapshots are too large for distribution.

**Solutions**:

1. Exclude models: `--no-include-models`
2. Exclude cache: `--no-include-cache`
3. Use maximum compression: `--compression 9`
4. Create incremental snapshots

### Slow Download/Upload

**Problem**: Network transfer takes too long.

**Solutions**:

1. Use CDN or closer remote storage
2. Implement resumable transfers
3. Split into smaller snapshots
4. Compress more aggressively

## Security Considerations

### Token Storage

- **Never commit tokens** to version control
- Use environment variables or secret management
- Rotate tokens regularly
- Use minimal required permissions

### Access Control

- Restrict who can create snapshots
- Use private repositories for sensitive data
- Review snapshot contents before publishing
- Implement approval workflows for production snapshots

### Data Privacy

- Snapshots contain parsed code and metadata
- Consider what's included in snapshots
- Use `.gitignore`-style filtering for sensitive files
- Encrypt snapshots if containing sensitive data

## Best Practices

### Versioning

- Use semantic versioning (major.minor.patch)
- Tag production snapshots clearly
- Create release snapshots for major versions
- Document breaking changes in descriptions

### Naming Conventions

- Use descriptive tags: `production`, `staging`, `testing`
- Include date in nightly snapshots: `nightly-YYYYMMDD`
- Add commit SHA for traceability

### Storage Management

- Implement retention policies
- Archive old snapshots
- Monitor storage usage
- Clean up test snapshots regularly

### Performance

- Use appropriate compression levels (6 for balance, 9 for size)
- Exclude unnecessary files (models, cache, logs)
- Schedule automated snapshots during low-traffic periods
- Use progress callbacks for long operations

## API Reference

For programmatic usage, import the snapshot system:

```typescript
import { SnapshotManager } from "ast-copilot-helper";

const manager = new SnapshotManager({
  localStoragePath: "./.snapshots",
  defaultCompressionLevel: 6,
  remoteStorage: [
    {
      type: "github",
      config: {
        owner: "example",
        repo: "repo",
        token: process.env.GITHUB_TOKEN,
      },
    },
  ],
});

// Create snapshot
const result = await manager.createSnapshot({
  version: "1.0.0",
  description: "Programmatic snapshot",
  tags: ["automated"],
});

// Restore snapshot
await manager.restoreSnapshot({
  snapshotPath: result.snapshotPath,
  createBackup: true,
});
```

## Future Enhancements

- **S3 Backend**: Support for AWS S3 storage
- **Azure Backend**: Support for Azure Blob Storage
- **Incremental Snapshots**: Delta-based snapshots
- **Compression Options**: Alternative compression algorithms
- **Encryption**: Built-in encryption for sensitive data
- **Resume Support**: Resumable uploads/downloads
- **Snapshot Diffing**: Compare snapshots
- **Snapshot Merging**: Combine snapshots
- **Web UI**: Browser-based snapshot management

## Support

For issues or questions:

- GitHub Issues: https://github.com/example/repo/issues
- Documentation: https://docs.example.com/snapshots
- Community: https://discord.gg/example

## License

See [LICENSE](../LICENSE) for details.
