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
* **Build and type-check frontend and API functions**: `npm run build`

## Analytics Dashboard Deployment

The website analytics API uses Neon PostgreSQL. Configure these environment variables in the Vercel project settings; do not commit credentials or put them in frontend code:

* `DATABASE_URL` — Neon connection string
* `ADMIN_USERNAME` — dashboard login name
* `ADMIN_PASSWORD` — dashboard password
* `ADMIN_SESSION_SECRET` — a long, random secret used to sign the admin session cookie

The analytics table and indexes are created automatically on the first event or dashboard request. New deployments start with zero recorded events; placeholder totals from the former static dashboard are not carried over. Admin sign-in is available at `/admin`.

For local API development, set the variables in the ignored root `.env` file and run the project with the Vercel CLI (`npx vercel dev`). `npm run dev` starts Vite only and does not serve the `/api/*` functions. The website collects anonymous click and conversion events only after the visitor opts in; the dashboard displays aggregate totals and a paginated event table.

## Common Issues
* **Windows File Locking (os error 32)**: Windows Defender real-time scanning can sometimes lock Rust object files during compilation. We have configured `.cargo/config.toml` to reduce this risk. If you see this error, run `cargo clean` or wait a few seconds and try again.
