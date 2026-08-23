# Contributing to AnyFile Convert

Welcome! AnyFile Convert is a privacy-first, offline-first desktop file toolbox. We are thrilled you want to contribute.

Our core philosophy is **"Vertical Slices."** We don't build generic abstractions hoping they'll be useful later. We build specific tools end-to-end (drop file → process → result) and extract patterns only when they repeat.

## Getting Started

1. Read **[DEVELOPMENT.md](DEVELOPMENT.md)** for local setup instructions. (Note: These might be temporarily unavailable as we restructure documentation).
2. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** to understand the Rust + Tauri architecture.
3. Check the [issue tracker](https://github.com/anyfile-converter/Anyfile-Converter/issues) for `good first issue` or `help wanted` labels.

## Adding a New Tool

This is the most common and valuable contribution. You can add a new tool without touching the UI or the core job system!

Please read **[Adding a Tool](docs/development/adding-a-tool.md)** for a 5-step guide.

## Contribution Guidelines

### 1. License
By contributing, you agree that your contributions will be licensed under the project's **GPL-3.0-or-later** license.

### 2. Rust Code
- We use stable Rust.
- Run `cargo fmt` before committing.
- Run `cargo clippy --workspace -- -D warnings` and fix any warnings.
- Keep `tauri` out of the `crates/` directory.

### 3. Frontend Code
- We use React and TypeScript.
- Run `npm run lint` and `npm run type-check`.
- The frontend should be a "dumb client" — all file processing logic must be in Rust.

### 4. Privacy First
Never add network requests to analytics, telemetry, or file processing. Operations must work 100% offline.

## CI / CD & Release Automation

We have automated GitHub Actions to ensure code quality and handle distribution:

1. **Continuous Integration (CI):** Every push and PR runs `cargo clippy`, `cargo fmt`, and `cargo test`. This ensures code safety. Because we compile over 300+ native Rust dependencies, the CI can take 5-6 minutes. We use aggressive caching (`rust-cache`) to keep this as fast as possible, but please run these checks locally before pushing to save CI resources!
2. **Automated Releases:** When a PR is merged into `main` and you want to publish a new update, you do **NOT** need to manually compile the `.exe`. Simply create a tag (e.g. `git tag v0.1.2`) and push it (`git push origin v0.1.2`).
3. **The Build Process:** The release pipeline takes **10+ minutes** because it performs a highly-optimized `--release` compilation of the entire Rust backend, webview2 components, and cryptographic signatures. This heavy lifting guarantees the app runs blazing fast on users' machines. Once finished, it securely signs the NSIS installer and publishes it to GitHub Releases.

## Submitting a Pull Request
1. Fork the repo and create your branch from `main`.
2. Ensure CI passes locally (tests, lint, formatting).
3. Open a PR using the provided template.
4. A maintainer will review your code. We aim to review PRs within 48 hours.

Thank you for helping make file processing private and accessible!
