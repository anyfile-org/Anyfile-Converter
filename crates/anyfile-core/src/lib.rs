//! # anyfile-core
//!
//! The core of AnyFile Convert — Tauri-agnostic.
//!
//! This crate contains:
//! - The [`Tool`] trait that every operation implements
//! - [`ToolRegistry`] — the central registry of all available tools
//! - [`Job`], [`JobState`], [`JobManager`] — the full job lifecycle
//! - [`ProgressReporter`] — progress reporting from tools to the UI
//! - Error types shared across the application
//!
//! ## Architecture Rule
//! This crate MUST NOT depend on `tauri`. It is a pure Rust library
//! that can be tested independently of any desktop framework.

pub mod error;
pub mod job;
pub mod job_manager;
pub mod progress;
pub mod registry;
pub mod tool;

// Convenient re-exports for crate consumers
pub use error::CoreError;
pub use job::{Job, JobError, JobId, JobProgress, JobRequest, JobResult, JobState, OutputConfig, PerFileError};
pub use job_manager::{JobEvent, JobManager};
pub use progress::ProgressReporter;
pub use registry::ToolRegistry;
pub use tool::{Tool, ToolCategory, ToolError, ToolMetadata};
