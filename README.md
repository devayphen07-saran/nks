# NKS — Namma Kadai System

A pnpm monorepo workspace for the NKS platform.

## Structure

```
nks/
├── apps/          # Runnable applications (web, mobile, backend, etc.)
├── packages/      # Shared libraries and utilities
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

```bash
# Install all dependencies
pnpm install

# Run all apps in dev mode (parallel)
pnpm dev

# Build everything
pnpm build

# Run tests across all packages
pnpm test
```

## Adding a new app or package

```bash
# Create a new app
mkdir apps/my-app && cd apps/my-app && pnpm init

# Create a new shared package
mkdir packages/my-package && cd packages/my-package && pnpm init
```
