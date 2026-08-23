use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Categories that group related tools in the UI sidebar.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    Image,
    Video,
    Audio,
    Pdf,
    Document,
    Archive,
}

/// Which processing engine a tool requires.
/// Used by the engine manager to check availability at startup.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineKind {
    /// Pure Rust — always available, no external binary needed.
    BuiltIn,
    /// FFmpeg subprocess — must be found on PATH or in bundled location.
    Ffmpeg,
    /// LibreOffice subprocess — must be installed separately.
    LibreOffice,
}

/// Describes a tool's identity, capabilities, and requirements.
///
/// Uses `String` (not `&'static str`) to keep the architecture open
/// for future plugin-style tool loading.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMetadata {
    /// Unique identifier, e.g. `"image.jpg_to_png"`.
    pub id: String,
    /// Human-readable name shown in the UI, e.g. `"Convert JPG → PNG"`.
    pub name: String,
    /// Short description shown as a tooltip or subtitle.
    pub description: String,
    /// Category for sidebar grouping.
    pub category: ToolCategory,
    /// File extensions this tool accepts as input (lowercase, no dot).
    pub input_extensions: Vec<String>,
    /// Extension of the output file produced (lowercase, no dot).
    pub output_extension: String,
    /// Which engine this tool requires.
    pub requires_engine: EngineKind,
}

/// Errors produced during tool validation or execution.
#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum ToolError {
    #[error("No input files provided")]
    NoInputFiles,

    #[error("Unsupported input format: {0}")]
    UnsupportedFormat(String),

    #[error("Required engine is not available: {0}")]
    EngineNotAvailable(String),

    #[error("Invalid options: {0}")]
    InvalidOptions(String),

    #[error("Processing failed: {0}")]
    ProcessingFailed(String),

    #[error("Operation was cancelled")]
    Cancelled,

    #[error("Output error: {0}")]
    OutputError(String),
}

/// The output produced when a tool executes successfully.
#[derive(Debug, Clone)]
pub struct JobOutput {
    pub output_files: Vec<std::path::PathBuf>,
    pub per_file_errors: Vec<crate::job::PerFileError>,
}

/// Every file operation implements this trait.
///
/// # Implementing a New Tool
///
/// 1. Create a new file in `crates/anyfile-tools/src/<category>/<name>.rs`
/// 2. Implement this trait
/// 3. Add tests
/// 4. Register in `crates/anyfile-tools/src/lib.rs` via `register_tools()`
///
/// See `docs/development/adding-a-tool.md` for the full walkthrough.
#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    /// Static metadata about this tool — called frequently, must be cheap.
    fn metadata(&self) -> &ToolMetadata;

    /// Validate the request before creating a job.
    ///
    /// Return a user-facing [`ToolError`] if the request is invalid.
    /// This runs synchronously on the calling thread.
    fn validate(&self, request: &crate::job::JobRequest) -> Result<(), ToolError>;

    /// Execute the operation.
    ///
    /// - Report progress via [`crate::progress::ProgressReporter`]
    /// - Check `cancel.is_cancelled()` periodically and return [`ToolError::Cancelled`]
    /// - Never load entire large files into memory unnecessarily
    async fn execute(
        &self,
        request: &crate::job::JobRequest,
        progress: crate::progress::ProgressReporter,
        cancel: tokio_util::sync::CancellationToken,
    ) -> Result<JobOutput, ToolError>;
}
