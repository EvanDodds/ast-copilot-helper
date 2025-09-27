# CI/CD Integration Examples

This document provides detailed examples for integrating the release management system with various CI/CD platforms and development workflows.

## GitHub Actions

### Complete Release Workflow

```yaml
# .github/workflows/release.yml
name: Automated Release Management

on:
  push:
    branches: [main, develop]
    paths-ignore: ["docs/**", "*.md"]

  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  workflow_dispatch:
    inputs:
      release_type:
        description: "Release type"
        required: true
        default: "patch"
        type: choice
        options:
          - patch
          - minor
          - major
          - prerelease
          - hotfix
      version:
        description: "Specific version (optional)"
        required: false
        type: string
      dry_run:
        description: "Dry run (no actual publishing)"
        required: false
        default: false
        type: boolean

env:
  NODE_VERSION: "24"
  REGISTRY_URL: "https://registry.npmjs.org/"

jobs:
  validate:
    name: Validate Release
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    outputs:
      can_release: ${{ steps.check.outputs.can_release }}
      next_version: ${{ steps.check.outputs.next_version }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
          registry-url: ${{ env.REGISTRY_URL }}

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Validate release plan
        id: check
        run: |
          node scripts/validate-release.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  release:
    name: Execute Release
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'

    permissions:
      contents: write
      packages: write
      pull-requests: write
      issues: write

    outputs:
      version: ${{ steps.release.outputs.version }}
      success: ${{ steps.release.outputs.success }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
          registry-url: ${{ env.REGISTRY_URL }}

      - name: Configure Git
        run: |
          git config user.name "Release Bot"
          git config user.email "release-bot@users.noreply.github.com"

      - name: Install dependencies
        run: npm ci

      - name: Run quality checks
        run: |
          npm run lint
          npm run type-check
          npm test
          npm run build

      - name: Execute release
        id: release
        run: node scripts/automated-release.js
        env:
          GITHUB_TOKEN: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          RELEASE_TYPE: ${{ github.event.inputs.release_type || 'auto' }}
          RELEASE_VERSION: ${{ github.event.inputs.version || '' }}
          DRY_RUN: ${{ github.event.inputs.dry_run || 'false' }}

      - name: Upload release artifacts
        if: steps.release.outputs.success == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: release-artifacts-${{ steps.release.outputs.version }}
          path: |
            dist/
            *.tgz
            CHANGELOG.md
            release-notes.md

      - name: Create GitHub Release
        if: steps.release.outputs.success == 'true'
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ steps.release.outputs.version }}
          release_name: Release ${{ steps.release.outputs.version }}
          body_path: release-notes.md
          draft: false
          prerelease: ${{ contains(steps.release.outputs.version, '-') }}

  docker:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    needs: release
    if: needs.release.outputs.success == 'true'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            myorg/myproject:latest
            myorg/myproject:${{ needs.release.outputs.version }}
            myorg/myproject:v${{ needs.release.outputs.version }}
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max

  notify:
    name: Post-Release Notifications
    runs-on: ubuntu-latest
    needs: [release, docker]
    if: always()

    steps:
      - name: Notify team
        run: |
          if [ "${{ needs.release.result }}" == "success" ]; then
            echo "✅ Release ${{ needs.release.outputs.version }} completed successfully"
          else
            echo "❌ Release failed"
          fi

      - name: Update documentation site
        if: needs.release.outputs.success == 'true'
        run: |
          # Trigger documentation rebuild
          curl -X POST \
            -H "Authorization: token ${{ secrets.DOCS_DEPLOY_TOKEN }}" \
            -H "Accept: application/vnd.github.v3+json" \
            https://api.github.com/repos/myorg/docs/dispatches \
            -d '{"event_type":"release","client_payload":{"version":"${{ needs.release.outputs.version }}"}}'
```

### Release Validation Script

```javascript
// scripts/validate-release.js
const {
  ComprehensiveReleaseManager,
  ReleaseType,
} = require("../packages/ast-copilot-helper/src/release-management");
const { readFileSync } = require("fs");
const { join } = require("path");

async function validateRelease() {
  try {
    const manager = new ComprehensiveReleaseManager();

    // Load configuration
    const config = JSON.parse(readFileSync(".releaserc.json", "utf-8"));
    await manager.initialize(config);

    // Detect if release is needed
    const currentVersion = await manager.getLatestVersion("stable");
    const changes = await manager.generateChangelog(currentVersion, "HEAD");

    if (changes.entries.length === 0) {
      console.log("No changes detected - no release needed");
      setOutput("can_release", "false");
      return;
    }

    // Determine release type
    let releaseType = ReleaseType.PATCH;
    if (changes.breakingChanges.length > 0) {
      releaseType = ReleaseType.MAJOR;
    } else if (changes.newFeatures.length > 0) {
      releaseType = ReleaseType.MINOR;
    }

    // Calculate next version
    const versionManager = manager.versionManager;
    const nextVersion = await versionManager.calculateNextVersion(
      currentVersion,
      releaseType,
      changes.entries,
    );

    console.log(
      `Validation successful: ${currentVersion} → ${nextVersion} (${releaseType})`,
    );
    console.log(
      `Changes: ${changes.entries.length} commits, ${changes.breakingChanges.length} breaking`,
    );

    // Create and validate release plan
    const plan = await manager.planRelease(nextVersion, releaseType);
    const validation = await manager.validateRelease(plan);

    if (validation.success) {
      setOutput("can_release", "true");
      setOutput("next_version", nextVersion);
      console.log("✅ Release validation passed");
    } else {
      setOutput("can_release", "false");
      console.error("❌ Release validation failed:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Validation failed:", error.message);
    setOutput("can_release", "false");
    process.exit(1);
  }
}

function setOutput(name, value) {
  console.log(`::set-output name=${name}::${value}`);
}

validateRelease();
```

## GitLab CI

### Complete Pipeline Configuration

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - test
  - build
  - release
  - deploy
  - notify

variables:
  NODE_VERSION: "24"
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""

.node_template: &node_template
  image: node:${NODE_VERSION}
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .npm/
  before_script:
    - npm config set cache .npm
    - npm ci --prefer-offline

validate_release:
  <<: *node_template
  stage: validate
  script:
    - npm run lint
    - npm run type-check
    - node scripts/validate-release.js
  artifacts:
    reports:
      junit: test-results.xml
    paths:
      - release-plan.json
    expire_in: 1 hour
  only:
    - merge_requests
    - main
    - develop

test:
  <<: *node_template
  stage: test
  script:
    - npm test
    - npm run test:integration
    - npm run test:e2e
  coverage: '/Statements\s*:\s*([^%]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: test-results.xml
    paths:
      - coverage/
    expire_in: 1 week

build:
  <<: *node_template
  stage: build
  script:
    - npm run build
    - npm pack
  artifacts:
    paths:
      - dist/
      - "*.tgz"
    expire_in: 1 week
  only:
    - main

release:
  <<: *node_template
  stage: release
  script:
    - node scripts/automated-release.js
  artifacts:
    paths:
      - CHANGELOG.md
      - release-notes.md
      - dist/
    expire_in: 1 month
  environment:
    name: production
    url: https://npmjs.com/package/mypackage
  only:
    - main
  when: manual

docker_build:
  stage: deploy
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  dependencies:
    - build
    - release
  script:
    - echo $CI_REGISTRY_PASSWORD | docker login -u $CI_REGISTRY_USER --password-stdin $CI_REGISTRY
    - |
      VERSION=$(cat package.json | grep version | cut -d '"' -f 4)
      docker build -t $CI_REGISTRY_IMAGE:$VERSION -t $CI_REGISTRY_IMAGE:latest .
      docker push $CI_REGISTRY_IMAGE:$VERSION
      docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
  needs:
    - job: release
      artifacts: true

notify_success:
  image: curlimages/curl:latest
  stage: notify
  dependencies:
    - release
  script:
    - |
      VERSION=$(cat package.json | grep version | cut -d '"' -f 4)
      curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Release $VERSION completed successfully!\"}" \
        $SLACK_WEBHOOK_URL
  only:
    - main
  when: on_success

notify_failure:
  image: curlimages/curl:latest
  stage: notify
  script:
    - |
      curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"❌ Release pipeline failed for commit $CI_COMMIT_SHA\"}" \
        $SLACK_WEBHOOK_URL
  only:
    - main
  when: on_failure
```

## Azure DevOps

### Pipeline Configuration

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    exclude:
      - docs/*
      - "*.md"

pr:
  branches:
    include:
      - main
  paths:
    exclude:
      - docs/*
      - "*.md"

variables:
  - group: release-secrets
  - name: nodeVersion
    value: "24.x"
  - name: npmRegistry
    value: "https://registry.npmjs.org/"

stages:
  - stage: Validate
    displayName: "Validate Release"
    condition: eq(variables['Build.Reason'], 'PullRequest')
    jobs:
      - job: ValidateRelease
        displayName: "Validate Release Plan"
        pool:
          vmImage: "ubuntu-latest"
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
            displayName: "Install Node.js"

          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              restoreKeys: |
                npm | "$(Agent.OS)"
              path: ~/.npm
            displayName: "Cache npm"

          - script: npm ci
            displayName: "Install dependencies"

          - script: |
              npm run lint
              npm run type-check
              npm test
              npm run build
            displayName: "Quality checks"

          - script: node scripts/validate-release.js
            displayName: "Validate release plan"
            env:
              AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)

  - stage: Release
    displayName: "Execute Release"
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    dependsOn: []
    jobs:
      - deployment: ExecuteRelease
        displayName: "Execute Release"
        environment: "production"
        pool:
          vmImage: "ubuntu-latest"
        strategy:
          runOnce:
            deploy:
              steps:
                - checkout: self
                  persistCredentials: true

                - task: NodeTool@0
                  inputs:
                    versionSpec: $(nodeVersion)
                  displayName: "Install Node.js"

                - script: |
                    git config user.name "Release Bot"
                    git config user.email "release-bot@company.com"
                  displayName: "Configure Git"

                - script: npm ci
                  displayName: "Install dependencies"

                - script: |
                    npm run lint
                    npm run type-check
                    npm test
                    npm run build
                  displayName: "Quality checks"

                - script: node scripts/automated-release.js
                  displayName: "Execute release"
                  env:
                    AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
                    NPM_TOKEN: $(NPM_TOKEN)
                    SLACK_WEBHOOK_URL: $(SLACK_WEBHOOK_URL)

                - task: PublishBuildArtifacts@1
                  inputs:
                    pathToPublish: "dist"
                    artifactName: "release-artifacts"
                  condition: succeeded()

                - task: GitHubRelease@1
                  inputs:
                    gitHubConnection: "GitHub"
                    repositoryName: "$(Build.Repository.Name)"
                    action: "create"
                    target: "$(Build.SourceVersion)"
                    tagSource: "userSpecifiedTag"
                    tag: "v$(RELEASE_VERSION)"
                    title: "Release $(RELEASE_VERSION)"
                    releaseNotesFilePath: "release-notes.md"
                    assets: "dist/*"
                  condition: succeeded()

  - stage: Deploy
    displayName: "Deploy Containers"
    dependsOn: Release
    condition: succeeded()
    jobs:
      - job: BuildAndPushDocker
        displayName: "Build and Push Docker Image"
        pool:
          vmImage: "ubuntu-latest"
        steps:
          - task: Docker@2
            displayName: "Build and push Docker image"
            inputs:
              containerRegistry: "DockerHub"
              repository: "myorg/myproject"
              command: "buildAndPush"
              Dockerfile: "**/Dockerfile"
              tags: |
                $(RELEASE_VERSION)
                latest
```

## Jenkins

### Pipeline Script

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        NODE_VERSION = '24'
        NPM_REGISTRY = 'https://registry.npmjs.org/'
        DOCKER_REGISTRY = 'docker.io'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        retry(2)
    }

    triggers {
        githubPush()
        pollSCM('H/15 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Setup') {
            steps {
                nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                    sh 'npm ci'
                }
            }
        }

        stage('Quality Checks') {
            parallel {
                stage('Lint') {
                    steps {
                        nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                            sh 'npm run lint'
                        }
                    }
                }

                stage('Type Check') {
                    steps {
                        nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                            sh 'npm run type-check'
                        }
                    }
                }

                stage('Security Audit') {
                    steps {
                        nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                            sh 'npm audit --audit-level moderate'
                        }
                    }
                }
            }
        }

        stage('Test') {
            steps {
                nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                    sh 'npm test'
                    sh 'npm run test:coverage'
                }
            }
            post {
                always {
                    publishTestResults testResultsPattern: 'test-results.xml'
                    publishCoverage adapters: [
                        cobertura('coverage/cobertura-coverage.xml')
                    ]
                }
            }
        }

        stage('Build') {
            steps {
                nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                    sh 'npm run build'
                    sh 'npm pack'
                }
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/**, *.tgz', fingerprint: true
                }
            }
        }

        stage('Validate Release') {
            when {
                anyOf {
                    branch 'main'
                    changeRequest()
                }
            }
            steps {
                nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                    script {
                        def canRelease = sh(
                            script: 'node scripts/validate-release.js',
                            returnStatus: true
                        )

                        if (canRelease == 0) {
                            env.CAN_RELEASE = 'true'
                        } else {
                            env.CAN_RELEASE = 'false'
                            echo 'No release needed or validation failed'
                        }
                    }
                }
            }
        }

        stage('Release') {
            when {
                allOf {
                    branch 'main'
                    environment name: 'CAN_RELEASE', value: 'true'
                }
            }
            steps {
                nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                    withCredentials([
                        string(credentialsId: 'npm-token', variable: 'NPM_TOKEN'),
                        string(credentialsId: 'github-token', variable: 'GITHUB_TOKEN'),
                        string(credentialsId: 'slack-webhook', variable: 'SLACK_WEBHOOK_URL')
                    ]) {
                        sh '''
                            git config user.name "Jenkins Release Bot"
                            git config user.email "jenkins@company.com"
                            node scripts/automated-release.js
                        '''
                    }
                }
            }
            post {
                success {
                    script {
                        def version = readJSON file: 'package.json'
                        env.RELEASE_VERSION = version.version
                    }
                    archiveArtifacts artifacts: 'CHANGELOG.md, release-notes.md'
                }
            }
        }

        stage('Docker Build') {
            when {
                allOf {
                    branch 'main'
                    environment name: 'CAN_RELEASE', value: 'true'
                }
            }
            steps {
                script {
                    def image = docker.build("myorg/myproject:${env.RELEASE_VERSION}")

                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'dockerhub-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                allOf {
                    branch 'main'
                    environment name: 'CAN_RELEASE', value: 'true'
                }
            }
            steps {
                build job: 'deploy-to-staging',
                      parameters: [string(name: 'VERSION', value: env.RELEASE_VERSION)]

                script {
                    def userInput = input(
                        id: 'deployToProd',
                        message: 'Deploy to production?',
                        parameters: [
                            choice(
                                choices: ['No', 'Yes'],
                                description: 'Deploy release to production?',
                                name: 'DEPLOY_TO_PROD'
                            )
                        ]
                    )

                    if (userInput == 'Yes') {
                        build job: 'deploy-to-production',
                              parameters: [string(name: 'VERSION', value: env.RELEASE_VERSION)]
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }

        success {
            script {
                if (env.RELEASE_VERSION) {
                    slackSend(
                        channel: '#releases',
                        color: 'good',
                        message: "✅ Release ${env.RELEASE_VERSION} completed successfully! 🎉"
                    )
                }
            }
        }

        failure {
            slackSend(
                channel: '#releases',
                color: 'danger',
                message: "❌ Release pipeline failed for commit ${env.GIT_COMMIT_SHORT}"
            )
        }
    }
}
```

## Package Scripts

### Complete npm scripts configuration

```json
{
  "scripts": {
    "prepare": "husky install",
    "prebuild": "npm run clean && npm run type-check",
    "build": "tsc && npm run build:docs",
    "build:docs": "typedoc --out docs/api src/index.ts",
    "clean": "rimraf dist coverage .nyc_output",
    "dev": "tsc --watch",
    "lint": "eslint src/**/*.ts --fix",
    "lint:check": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "release": "node scripts/interactive-release.js",
    "release:dry-run": "DRY_RUN=true node scripts/automated-release.js",
    "release:patch": "RELEASE_TYPE=patch node scripts/automated-release.js",
    "release:minor": "RELEASE_TYPE=minor node scripts/automated-release.js",
    "release:major": "RELEASE_TYPE=major node scripts/automated-release.js",
    "release:prerelease": "RELEASE_TYPE=prerelease node scripts/automated-release.js",
    "release:hotfix": "RELEASE_TYPE=hotfix node scripts/automated-release.js",
    "validate-release": "node scripts/validate-release.js",
    "changelog": "node scripts/generate-changelog.js",
    "version-check": "node scripts/version-check.js"
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run type-check",
      "pre-push": "npm run test && npm run build",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": ["eslint --fix", "git add"],
    "**/*.{json,md,yml,yaml}": ["prettier --write", "git add"]
  },
  "commitlint": {
    "extends": ["@commitlint/config-conventional"]
  }
}
```

### Interactive Release Script

```javascript
// scripts/interactive-release.js
const inquirer = require("inquirer");
const {
  ComprehensiveReleaseManager,
  ReleaseType,
} = require("../packages/ast-copilot-helper/src/release-management");
const { readFileSync } = require("fs");
const chalk = require("chalk");

async function interactiveRelease() {
  console.log(chalk.blue("🚀 Interactive Release Manager\n"));

  try {
    const manager = new ComprehensiveReleaseManager();
    const config = JSON.parse(readFileSync(".releaserc.json", "utf-8"));
    await manager.initialize(config);

    // Get current version and changes
    const currentVersion = await manager.getLatestVersion("stable");
    const changes = await manager.generateChangelog(currentVersion, "HEAD");

    console.log(chalk.gray(`Current version: ${currentVersion}`));
    console.log(
      chalk.gray(`Pending changes: ${changes.entries.length} commits\n`),
    );

    if (changes.entries.length === 0) {
      console.log(chalk.yellow("No changes detected. No release needed."));
      return;
    }

    // Show change summary
    console.log(chalk.bold("Change Summary:"));
    console.log(
      `  ${chalk.green("✨ Features:")} ${changes.newFeatures.length}`,
    );
    console.log(`  ${chalk.blue("🐛 Bug fixes:")} ${changes.bugFixes.length}`);
    console.log(
      `  ${chalk.red("💥 Breaking:")} ${changes.breakingChanges.length}`,
    );
    console.log();

    // Release type selection
    const releaseTypeChoices = [
      {
        name: `${chalk.red(
          "Major",
        )} - Breaking changes (${currentVersion} → ${incrementVersion(
          currentVersion,
          "major",
        )})`,
        value: ReleaseType.MAJOR,
        disabled:
          changes.breakingChanges.length === 0
            ? "No breaking changes detected"
            : false,
      },
      {
        name: `${chalk.yellow(
          "Minor",
        )} - New features (${currentVersion} → ${incrementVersion(
          currentVersion,
          "minor",
        )})`,
        value: ReleaseType.MINOR,
        disabled:
          changes.newFeatures.length === 0 ? "No new features detected" : false,
      },
      {
        name: `${chalk.green(
          "Patch",
        )} - Bug fixes (${currentVersion} → ${incrementVersion(
          currentVersion,
          "patch",
        )})`,
        value: ReleaseType.PATCH,
      },
      {
        name: `${chalk.blue(
          "Prerelease",
        )} - Alpha/Beta (${currentVersion} → ${incrementVersion(
          currentVersion,
          "prerelease",
        )})`,
        value: ReleaseType.PRERELEASE,
      },
      {
        name: `${chalk.magenta(
          "Hotfix",
        )} - Emergency fix (${currentVersion} → ${incrementVersion(
          currentVersion,
          "hotfix",
        )})`,
        value: ReleaseType.HOTFIX,
      },
    ];

    const { releaseType } = await inquirer.prompt([
      {
        type: "list",
        name: "releaseType",
        message: "Select release type:",
        choices: releaseTypeChoices,
      },
    ]);

    // Calculate version
    const versionManager = manager.versionManager;
    const nextVersion = await versionManager.calculateNextVersion(
      currentVersion,
      releaseType,
      changes.entries,
    );

    // Custom version option
    const { useCustomVersion } = await inquirer.prompt([
      {
        type: "confirm",
        name: "useCustomVersion",
        message: `Use calculated version ${chalk.bold(nextVersion)}?`,
        default: true,
      },
    ]);

    let targetVersion = nextVersion;
    if (!useCustomVersion) {
      const { customVersion } = await inquirer.prompt([
        {
          type: "input",
          name: "customVersion",
          message: "Enter custom version:",
          validate: (input) => {
            if (!input.match(/^\d+\.\d+\.\d+/)) {
              return "Please enter a valid semantic version (e.g., 1.2.3)";
            }
            return true;
          },
        },
      ]);
      targetVersion = customVersion;
    }

    // Platform selection
    const availablePlatforms = config.platforms.map((p) => p.name);
    const { selectedPlatforms } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedPlatforms",
        message: "Select platforms to publish:",
        choices: availablePlatforms,
        default: availablePlatforms.filter(
          (p) => config.platforms.find((cp) => cp.name === p)?.enabled,
        ),
      },
    ]);

    // Dry run option
    const { dryRun } = await inquirer.prompt([
      {
        type: "confirm",
        name: "dryRun",
        message: "Perform dry run (no actual publishing)?",
        default: false,
      },
    ]);

    // Final confirmation
    console.log(chalk.bold("\n📋 Release Summary:"));
    console.log(
      `  Version: ${chalk.bold(currentVersion)} → ${chalk.bold(targetVersion)}`,
    );
    console.log(`  Type: ${chalk.bold(releaseType)}`);
    console.log(`  Platforms: ${selectedPlatforms.join(", ")}`);
    console.log(
      `  Mode: ${dryRun ? chalk.yellow("DRY RUN") : chalk.green("LIVE")}`,
    );
    console.log();

    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: "Proceed with release?",
        default: false,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.yellow("Release cancelled."));
      return;
    }

    // Execute release
    console.log(chalk.blue("\n🔄 Executing release...\n"));

    // Update config for selected platforms
    const releaseConfig = {
      ...config,
      dryRun,
      platforms: config.platforms.map((p) => ({
        ...p,
        enabled: selectedPlatforms.includes(p.name),
      })),
    };

    await manager.initialize(releaseConfig);

    const plan = await manager.planRelease(targetVersion, releaseType);
    const validation = await manager.validateRelease(plan);

    if (!validation.success) {
      console.error(chalk.red("❌ Release validation failed:"));
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      return;
    }

    const result = await manager.executeRelease(plan);

    if (result.success) {
      console.log(
        chalk.green(
          `\n✅ Release ${result.version} completed successfully! 🎉`,
        ),
      );
      console.log(`Duration: ${result.duration}ms`);
      if (result.publishResults) {
        console.log("Published to:");
        result.publishResults.forEach((pr) => {
          console.log(
            `  - ${pr.platform}: ${pr.success ? "✅" : "❌"} ${
              pr.url || pr.error || ""
            }`,
          );
        });
      }
    } else {
      console.error(chalk.red(`❌ Release failed: ${result.error}`));
    }
  } catch (error) {
    console.error(chalk.red("💥 Release process failed:"), error.message);
    process.exit(1);
  }
}

function incrementVersion(version, type) {
  const parts = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${parts[0] + 1}.0.0`;
    case "minor":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "patch":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    case "prerelease":
      return `${parts[0]}.${parts[1] + 1}.0-alpha.1`;
    case "hotfix":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}-hotfix.1`;
    default:
      return version;
  }
}

if (require.main === module) {
  interactiveRelease();
}

module.exports = { interactiveRelease };
```

This comprehensive CI/CD integration guide provides complete examples for all major platforms and development workflows.
