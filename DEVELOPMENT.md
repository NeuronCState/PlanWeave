# Development

This document is for contributors working from source. The main README is user-facing and assumes the `planweave` CLI is installed.

## Repository Layout

```text
packages/runtime   Core graph, package, executor, auto-run, and desktop bridge logic
packages/cli       planweave command-line interface
packages/desktop   Electron desktop canvas
examples           Example PlanWeave packages
scripts            Repository checks
skills             Agent skills distributed from this repository
readme             README assets and localized README content
archive            Historical planning material, not current implementation authority
```

## Source Setup

Install dependencies and build all packages:

```bash
pnpm install
pnpm -r build
```

Run the CLI from the workspace without installing it globally:

```bash
pnpm --filter @planweave/cli planweave --help
pnpm --filter @planweave/cli planweave help
```

Run the desktop app from source:

```bash
pnpm --dir packages/desktop start
```

## Verification

Run the full test suite:

```bash
pnpm test
```

Build the workspace:

```bash
pnpm -r build
```

Run the desktop smoke test after building:

```bash
pnpm --filter @planweave/desktop smoke
```

## Local Packaging

Build an unsigned macOS DMG and ZIP:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --dir packages/desktop dist:mac
```

Build Windows and Linux desktop artifacts with electron-builder:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --dir packages/desktop exec electron-builder --win nsis --x64 --publish never
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --dir packages/desktop exec electron-builder --win nsis --arm64 --publish never
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --dir packages/desktop exec electron-builder --linux AppImage --x64 --publish never
```

The generated desktop installers are ignored by git under `packages/desktop/release/`.
