# Contributing to AnyFile Convert

Welcome! AnyFile Convert is a privacy-first, offline-first desktop file toolbox built with **Rust + Tauri + React**. We're thrilled you want to contribute!

Our core philosophy is **"Vertical Slices."** We build specific tools end-to-end (drop file → process → result) and extract patterns only when they repeat. No premature abstractions.

---

## 🚀 How to Get a PR Merged

**This is the single most important section.** Follow these steps to get your contribution accepted smoothly:

1. **Star this repository** — As the main thing to get your PR merged and support the project, please leave a star! ⭐
2. **Find an issue** — Check the [issue tracker](https://github.com/anyfile-converter/Anyfile-Converter/issues) for issues labelled `good first issue` or `help wanted`.
3. **Comment your approach** — Before writing any code, leave a comment on the issue describing your plan in 2–3 sentences. Wait for a maintainer to assign you. This prevents wasted effort if the approach is wrong.
4. **Fork and branch** — Fork the repo, then create a branch named after your issue: `git checkout -b fix/settings-persistence` or `git checkout -b feat/webp-support`
5. **One issue per PR** — Keep changes focused. PRs that fix multiple unrelated things are much harder to review and will be asked to be split up.
6. **Pass CI locally first** — Before opening a PR, run these locally:
   ```bash
   cargo fmt --all
   cargo clippy --workspace -- -D warnings
   cargo test --workspace
   npm run type-check
   ```
   CI will run these automatically and block merges if they fail. Don't waste CI minutes on formatting errors.
6. **Open a PR with a clear description** — Explain *what* you changed and *why*. Link the issue number (e.g. `Closes #12`).
7. **Respond to reviews** — A maintainer will review within 48 hours. Address any feedback promptly.

> ⚡ **PRs that skip the issue comment step are likely to be closed**, even if the code is good — we can't have 3 people solving the same problem simultaneously.

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | stable | `rustup install stable` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | included with Node |

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Anyfile-Converter.git
cd Anyfile-Converter

# Install frontend dependencies
npm install

# Run the app in dev mode (Rust + React hot-reload)
npm run tauri dev
```

The first launch compiles all Rust dependencies and takes 3–5 minutes. Subsequent launches are under 10 seconds thanks to incremental compilation.

---

## Project Structure

```
src/                   # React + TypeScript frontend
  components/          # Reusable UI components
  pages/               # Route-level pages (Home, Jobs, Settings, About)
  stores/              # Zustand global state
  services/            # Tauri IPC wrappers
  types/               # Shared TypeScript types

crates/
  anyfile-core/        # Job lifecycle, JobManager, events (no Tauri!)
  anyfile-tools/       # Tool implementations (image, pdf, video, archive)
  anyfile-engines/     # Engine wrappers (ImageEngine, FFmpeg, PDF)
  anyfile-fs/          # File path resolution, output naming

src-tauri/
  src/
    commands/          # Tauri command handlers (thin wrappers)
    lib.rs             # App wiring, setup, event bridge
    registry.rs        # Windows context menu registration
```

---

## Adding a New Tool

Adding a tool is the most impactful contribution and doesn't require touching the core job system.

1. Create your tool struct in `crates/anyfile-tools/src/<category>/mod.rs` implementing the `Tool` trait
2. Register it in `crates/anyfile-tools/src/lib.rs`
3. Add it to the Windows context menu in `src-tauri/src/registry.rs`
4. Add its display name to `TOOL_NAMES` in `src/components/jobs/JobCard.tsx`

See the existing `JpgToPng` tool as a complete 60-line reference implementation.

---

## Contribution Guidelines

### Rust Code
- Use stable Rust only
- Run `cargo fmt --all` before committing
- Run `cargo clippy --workspace -- -D warnings` and fix every warning
- Keep `tauri` imports **out of** the `crates/` directory — those crates must be testable without Tauri

### Frontend Code
- Use React and TypeScript
- No external CSS frameworks (we use Vanilla CSS with CSS variables)
- The frontend is a "dumb client" — all file processing logic lives in Rust
- Run `npm run type-check` before committing

### Privacy First
Never add network requests for file processing or telemetry. All file operations must work 100% offline.

---

## CI / CD & Release Automation

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | Every push + PR | `cargo clippy`, `cargo fmt`, `cargo test`, type-check |
| **Release** | `git tag v*` | Builds optimized `.exe` NSIS installer, signs it, publishes to GitHub Releases |

> ⏱️ CI takes 5–6 minutes. Release builds take 10+ minutes. This is expected — we compile 300+ optimized Rust dependencies. We use `rust-cache` to minimize re-compilation.

To publish a new release after a PR is merged:
```bash
git tag v1.0.4
git push origin v1.0.4
```
GitHub Actions handles the rest automatically.

---

## Submitting a Pull Request

1. Fork → branch → implement → test locally
2. Open a PR with `Closes #<issue_number>` in the description
3. Ensure all CI checks pass
4. A maintainer will review within 48 hours

Thank you for helping make file processing private and accessible! 🙌
