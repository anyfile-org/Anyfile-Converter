//! # anyfile-engines
//!
//! Processing engine abstractions for AnyFile Convert.
//!
//! Each engine wraps a specific processing backend and provides
//! a clean, safe API to the tools layer.
//!
//! ## V0.1 Engines
//! - [`image::ImageEngine`]   — pure Rust `image` crate (JPG, PNG)
//! - [`pdf::PdfEngine`]       — pure Rust `lopdf` (merge, split)
//! - [`archive::ArchiveEngine`] — pure Rust `zip` crate
//! - [`ffmpeg::FfmpegEngine`] — external FFmpeg subprocess
//!
//! ## Architecture Rule
//! Tools must NEVER call `Command::new("ffmpeg")` directly.
//! All subprocess interaction goes through [`ffmpeg::FfmpegEngine`].

pub mod archive;
pub mod error;
pub mod ffmpeg;
pub mod image;
pub mod pdf;

pub use error::EngineError;
