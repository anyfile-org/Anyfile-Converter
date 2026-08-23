use thiserror::Error;

use crate::tool::ToolError;

/// Top-level errors from the AnyFile core.
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Job is not in a cancellable state")]
    NotCancellable,

    #[error("Tool validation failed: {0}")]
    ValidationFailed(#[from] ToolError),

    #[error("Filesystem error: {0}")]
    Filesystem(#[from] anyfile_fs::FsError),

    #[error("Internal error: {0}")]
    Internal(String),
}
