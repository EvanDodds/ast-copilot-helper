# Multi-stage Dockerfile for AST Copilot Helper monorepo
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
# Copy package.json files for each workspace
COPY packages/ast-core-engine/package.json ./packages/ast-core-engine/
COPY packages/ast-helper/package.json ./packages/ast-helper/
COPY packages/ast-mcp-server/package.json ./packages/ast-mcp-server/
COPY packages/vscode-extension/package.json ./packages/vscode-extension/

# Install dependencies (--immutable ensures lockfile consistency)
RUN yarn install --immutable

# Copy source code
COPY . .

# Build all packages
RUN yarn build

# Production stage
FROM node:20-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S asthelper && \
    adduser -S asthelper -u 1001 -G asthelper

# Set working directory
WORKDIR /app

# Copy built application with proper ownership
COPY --from=builder --chown=asthelper:asthelper /app/package.json ./
COPY --from=builder --chown=asthelper:asthelper /app/yarn.lock ./
COPY --from=builder --chown=asthelper:asthelper /app/.yarnrc.yml ./
COPY --from=builder --chown=asthelper:asthelper /app/.yarn ./.yarn
COPY --from=builder --chown=asthelper:asthelper /app/packages ./packages
COPY --from=builder --chown=asthelper:asthelper /app/node_modules ./node_modules

# Create data directory for AST database
RUN mkdir -p /data && chown asthelper:asthelper /data

# Switch to non-root user
USER asthelper

# Set environment variables
ENV NODE_ENV=production
ENV PATH="/app/packages/ast-mcp-server/bin:/app/packages/ast-helper/bin:$PATH"

# Create volume for data
VOLUME ["/data"]

# Expose default MCP server port
EXPOSE 3000

# Health check - test that the MCP server can start
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD /app/packages/ast-mcp-server/bin/ast-mcp-server --version || exit 1

# Default to MCP server
ENTRYPOINT ["/app/packages/ast-mcp-server/bin/ast-mcp-server"]
CMD ["--help"]

# Metadata labels
LABEL org.opencontainers.image.title="AST Copilot Helper"
LABEL org.opencontainers.image.description="This project provides a comprehensive toolkit for analyzing Abstract Syntax Trees (ASTs) of codebases and serving that data through a Model Context Protocol server."
LABEL org.opencontainers.image.source="https://github.com/EvanDodds/ast-copilot-helper"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="AST Copilot Helper Team"