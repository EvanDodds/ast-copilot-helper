# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.10] - 2025-09-30

### Fixed

- Resolve startup failures in release pipeline

## [1.0.9] - 2025-09-30

### Fixed

- Resolve release pipeline startup failures
- Improve version retrieval in CLI to support ES modules and fallback to workspace package.json

## [1.0.8] - 2025-09-30

### Fixed

- Add workflow_call trigger to CI workflow with skip-nightly input

## [1.0.3] - 2025-09-30

### Fixed

- Correct telemetry test environment variable handling
- Update build:binaries script to use npx for better compatibility
