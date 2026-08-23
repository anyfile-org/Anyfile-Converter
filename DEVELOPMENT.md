# Development Setup

Follow these steps to set up the development environment for AnyFile Convert.

## Prerequisites

1. **Rust**: Install the stable Rust toolchain via [rustup](https://rustup.rs/).
2. **Node.js**: Install Node.js v20 or later.
3. **Tauri Prerequisites**: 
   - **Windows**: Install the [C++ Build Tools and WebView2](https://tauri.app/v1/guides/getting-started/prerequisites#windows).
   - **macOS/Linux**: Follow the [Tauri guides](https://tauri.app/v1/guides/getting-started/prerequisites) for your platform.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/anyfile-convert/anyfile-convert.git
   cd anyfile-convert
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the development server (this will compile Rust and start the UI with Hot-Module Replacement):
   ```bash
   npm run tauri dev
   ```

## Workflow & Commands

* **Run Rust tests**: `cargo test --workspace`
* **Format Rust code**: `cargo fmt`
* **Lint Rust code**: `cargo clippy --workspace -- -D warnings`
* **Lint Frontend**: `npm run lint`
* **Type-check Frontend**: `npm run type-check`

## Common Issues
* **Windows File Locking (os error 32)**: Windows Defender real-time scanning can sometimes lock Rust object files during compilation. We have configured `.cargo/config.toml` to reduce this risk. If you see this error, run `cargo clean` or wait a few seconds and try again.
