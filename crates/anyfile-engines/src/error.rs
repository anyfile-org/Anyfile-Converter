use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Engine not available: {0}")]
    NotAvailable(String),

    #[error("Image processing error: {0}")]
    Image(String),

    #[error("PDF processing error: {0}")]
    Pdf(String),

    #[error("Archive error: {0}")]
    Archive(String),

    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("FFmpeg not found. Install FFmpeg and ensure it is on your PATH, or set a custom path in Settings.")]
    FfmpegNotFound,

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Filesystem error: {0}")]
    Fs(#[from] anyfile_fs::FsError),
}
