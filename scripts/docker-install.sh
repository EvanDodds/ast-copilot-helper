#!/bin/bash
set -e

echo "🔧 Installing dependencies in Docker environment..."

# Check if we're in a Docker container by looking for typical Docker markers
if [ -f /.dockerenv ] || grep -q 'docker\|lxc' /proc/1/cgroup 2>/dev/null; then
    echo "📦 Docker environment detected"
    
    # In Docker, we want to ensure clean state
    if [ -f yarn.lock ]; then
        echo "🔍 Using existing yarn.lock"
        # Try frozen-lockfile first, fallback if needed
        if ! yarn install --frozen-lockfile --network-timeout 300000; then
            echo "⚠️ Frozen lockfile failed, trying without immutable flag..."
            yarn install --network-timeout 300000
        fi
    else
        echo "❌ No yarn.lock found, this shouldn't happen in Docker build"
        exit 1
    fi
else
    echo "💻 Local environment detected"
    # In local environment, use standard approach
    yarn install
fi

echo "✅ Dependencies installed successfully"