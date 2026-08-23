use std::path::{Path, PathBuf};

use tracing::warn;

/// RAII guard for a temporary file.
///
/// The temp file is deleted when this guard is dropped.
/// Use this for intermediate files created during processing
/// so they are always cleaned up — even if the job fails or panics.
#[derive(Debug)]
pub struct TempFileGuard {
    path: PathBuf,
}

impl TempFileGuard {
    /// Register an existing path as a temp file to be deleted on drop.
    pub fn for_path(path: PathBuf) -> Self {
        Self { path }
    }

    /// Get the path to the temp file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Consume the guard without deleting the file.
    /// Use this when the file has been successfully moved to its final destination.
    pub fn persist(self) -> PathBuf {
        let p = self.path.clone();
        std::mem::forget(self);
        p
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.path.exists() {
            if let Err(e) = std::fs::remove_file(&self.path) {
                // Log but don't panic — drop must not panic
                warn!(
                    path = %self.path.display(),
                    error = %e,
                    "Failed to delete temp file on cleanup"
                );
            }
        }
    }
}
