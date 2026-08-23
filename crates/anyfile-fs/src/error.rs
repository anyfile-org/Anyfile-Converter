use thiserror::Error;

/// Errors produced by filesystem operations in AnyFile Convert.
#[derive(Debug, Error)]
pub enum FsError {
    #[error("Path not found: {0}")]
    NotFound(String),

    #[error("Path traversal detected — access denied: {0}")]
    PathTraversal(String),

    #[error("Path is not a file: {0}")]
    NotAFile(String),

    #[error("Path is not a directory: {0}")]
    NotADirectory(String),

    #[error("Unsupported file extension: {0}")]
    UnsupportedExtension(String),

    #[error("Output directory could not be created: {0}")]
    OutputDirectoryCreation(String),

    #[error("Temporary file error: {0}")]
    TempFile(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}
