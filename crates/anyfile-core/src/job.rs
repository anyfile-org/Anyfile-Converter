use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use anyfile_fs::{NamingPattern, OutputConfig as FsOutputConfig};

/// Unique identifier for a job.
pub type JobId = Uuid;

/// All possible states a job can be in during its lifecycle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    /// Waiting in the queue — not yet started.
    Queued,
    /// Actively being processed.
    Running,
    /// Finished successfully (possibly with per-file warnings).
    Completed,
    /// Finished with a fatal error.
    Failed,
    /// Explicitly cancelled by the user.
    Cancelled,
}

/// Progress snapshot for a job.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JobProgress {
    /// 0–100 overall completion percentage.
    pub overall_percent: u8,
    /// The file currently being processed, if applicable.
    pub current_file: Option<String>,
    /// Number of files successfully processed.
    pub files_done: usize,
    /// Total number of files in this job.
    pub files_total: usize,
}

/// Configuration for where and how output files are written.
/// Mirrors [`anyfile_fs::OutputConfig`] but is serialisable for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    pub directory: PathBuf,
    pub overwrite: bool,
    pub naming: NamingPattern,
}

impl From<&OutputConfig> for FsOutputConfig {
    fn from(c: &OutputConfig) -> Self {
        FsOutputConfig {
            directory: c.directory.clone(),
            overwrite: c.overwrite,
            naming: c.naming.clone(),
        }
    }
}

/// The data submitted by the frontend to create a new job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRequest {
    /// The tool to use, e.g. `"image.jpg_to_png"`.
    pub tool_id: String,
    /// One or many input files — same struct for single and batch.
    pub input_files: Vec<PathBuf>,
    /// Where to write output files and how to name them.
    pub output_config: OutputConfig,
    /// Tool-specific options (quality, format, etc.) — validated by the tool.
    pub options: serde_json::Value,
}

/// Per-file error for partial-success batch jobs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerFileError {
    pub input_file: PathBuf,
    pub message: String,
}

/// The result of a successfully completed job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    /// Paths to all output files written.
    pub output_files: Vec<PathBuf>,
    /// Wall-clock time for the entire job in milliseconds.
    pub duration_ms: u64,
    /// Files that failed within an otherwise-successful batch.
    pub per_file_errors: Vec<PerFileError>,
}

/// A fatal job-level error.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobError {
    /// User-facing error message — no stack traces.
    pub message: String,
    /// Whether retrying might succeed (e.g. engine not found vs corrupt file).
    pub recoverable: bool,
}

/// A job record — the full lifecycle snapshot of one operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: JobId,
    pub tool_id: String,
    pub state: JobState,
    pub input_files: Vec<PathBuf>,
    pub output_config: OutputConfig,
    pub options: serde_json::Value,
    pub progress: JobProgress,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub result: Option<JobResult>,
    pub error: Option<JobError>,
}

impl Job {
    pub fn new(request: JobRequest) -> Self {
        let files_total = request.input_files.len();
        Self {
            id: Uuid::new_v4(),
            tool_id: request.tool_id.clone(),
            state: JobState::Queued,
            input_files: request.input_files,
            output_config: request.output_config,
            options: request.options,
            progress: JobProgress {
                files_total,
                ..Default::default()
            },
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            result: None,
            error: None,
        }
    }
}
