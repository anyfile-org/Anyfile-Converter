//! # anyfile-tools
//!
//! All tool implementations for AnyFile Convert.
//!
//! ## Adding a New Tool
//!
//! 1. Create `src/<category>/<name>.rs`
//! 2. Implement the [`anyfile_core::Tool`] trait
//! 3. Write `#[cfg(test)]` unit tests in the same file
//! 4. Add ONE line to [`register_tools`] below
//! 5. Open a PR — that's it
//!
//! See `docs/development/adding-a-tool.md` for the full walkthrough.

pub mod archive;
pub mod image;
pub mod pdf;
pub mod video;

use anyfile_core::ToolRegistry;

/// Register all available tools.
///
/// Called once at application startup from `src-tauri/src/lib.rs`.
/// To add a new tool: implement `Tool`, then add one line here.
pub fn register_tools(registry: &mut ToolRegistry) {
    // ── Image ────────────────────────────────────────────────────────────
    registry.register(image::JpgToPng::new());
    registry.register(image::PngToJpg::new());
    registry.register(image::ImageToFormat::webp());
    registry.register(image::ImageToFormat::avif());
    registry.register(image::ImageCompress::new());

    // ── PDF ──────────────────────────────────────────────────────────────
    registry.register(pdf::PdfMerge::new());
    registry.register(pdf::PdfSplit::new());

    // ── Video ────────────────────────────────────────────────────────────
    registry.register(video::ExtractAudio::new());

    // ── Archive ──────────────────────────────────────────────────────────
    registry.register(archive::CreateZip::new());
    registry.register(archive::ExtractZip::new());
}
