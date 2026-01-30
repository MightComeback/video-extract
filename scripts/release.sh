#!/bin/bash
set -e

# Ensure clean state
if [[ -n $(git status -s) ]]; then
  echo "Error: working directory not clean. Commit or stash changes first."
  exit 1
fi

# Run tests
echo "Running tests..."
npm test

# Get version
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

# Check if tag exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists."
else
  echo "Creating tag $TAG..."
  git tag "$TAG"
  git push origin "$TAG"
  echo "Pushed $TAG."
fi
