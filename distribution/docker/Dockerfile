# Multi-stage Dockerfile for AST Copilot Helper
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Copy source code
COPY packages ./packages
COPY scripts ./scripts

# Install dependencies and build
RUN npm ci --only=production
RUN npm run build

# Production stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S asthelper && \
    adduser -S asthelper -u 1001 -G asthelper

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=asthelper:asthelper /app/dist ./dist
COPY --from=builder --chown=asthelper:asthelper /app/packages ./packages
COPY --from=builder --chown=asthelper:asthelper /app/node_modules ./node_modules
COPY --from=builder --chown=asthelper:asthelper /app/package.json ./

# Create data directory
RUN mkdir -p /data && chown asthelper:asthelper /data

# Switch to non-root user
USER asthelper

# Set environment variables
ENV NODE_ENV=production
ENV PATH="/app/dist/bin:$PATH"

# Expose default port (if web interface is added later)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/cli/healthcheck.js || exit 1

# Default command
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]

# Labels for metadata
LABEL org.opencontainers.image.title="AST Copilot Helper"
LABEL org.opencontainers.image.description="Advanced AST-powered development assistant"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/your-org/ast-copilot-helper"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="AST Copilot Helper Team"