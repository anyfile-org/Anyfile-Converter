# AnyFile Convert Architecture

AnyFile Convert is a native desktop application built with Rust and Tauri 2.x. 

## Design Principles
1. **Offline First**: All processing happens locally on the user's device. No cloud uploads.
2. **Privacy First**: No telemetry, no tracking, no external data sent without explicit user consent.
3. **Core is Pure Rust**: The `anyfile-core` crate knows nothing about Tauri or the frontend UI. It is an independent library that manages the processing lifecycle.
4. **Data-Driven UI**: The React frontend doesn't hardcode tool logic. It asks Rust for available tools and supported extensions, rendering "smart actions" based on the file dropped.

## Crate Layout
* `anyfile-core`: The job runner, progress tracking, tool registry, and traits.
* `anyfile-fs`: Secure file path handling, collision prevention, and temp file tracking.
* `anyfile-engines`: Wrappers for external processing engines (e.g., `image`, `lopdf`, `zip`, FFmpeg).
* `anyfile-tools`: Implementations of specific tools (e.g., `JpgToPng`, `PdfMerge`).
* `src-tauri`: The Tauri app that connects the Rust core to the frontend via IPC.
* `src`: The React + TypeScript UI.

## The Job Lifecycle
1. User drops files in the React frontend.
2. Frontend queries `tools_for_extension` to find applicable operations.
3. User clicks "Start". Frontend calls the `submit_job` Tauri command.
4. `JobManager` creates a `Job`, adds it to the queue, and returns the `JobId`.
5. A Tokio task processes the job asynchronously.
6. The `Tool` implementation uses `ProgressReporter` to emit progress updates.
7. Progress events are sent to the frontend via Tauri events (`app.emit`).
8. The Zustand store in React updates the UI in real-time.
