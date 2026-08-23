use std::path::Path;

use tokio::sync::mpsc;

use crate::job::JobId;

/// Update sent from a tool's `execute()` back to the job manager.
#[derive(Debug)]
pub enum ProgressUpdate {
    /// Overall percentage (0–100) and optionally the current file name.
    Percent {
        percent: u8,
        current_file: Option<String>,
    },
    /// A file in the batch was finished.
    FileDone {
        file: std::path::PathBuf,
        success: bool,
    },
}

/// Given to `Tool::execute()` so it can report progress without knowing
/// anything about Tauri or the job manager internals.
///
/// Cloning this reporter is cheap — it only clones the channel sender.
#[derive(Clone, Debug)]
pub struct ProgressReporter {
    tx: mpsc::Sender<ProgressUpdate>,
    job_id: JobId,
}

impl ProgressReporter {
    pub fn new(tx: mpsc::Sender<ProgressUpdate>, job_id: JobId) -> Self {
        Self { tx, job_id }
    }

    pub fn job_id(&self) -> JobId {
        self.job_id
    }

    /// Report an overall percentage completion.
    /// Silently drops the update if the receiver is gone (job was cancelled/cleaned up).
    pub fn set_percent(&self, percent: u8, current_file: Option<&str>) {
        let _ = self.tx.try_send(ProgressUpdate::Percent {
            percent: percent.min(100),
            current_file: current_file.map(str::to_owned),
        });
    }

    /// Convenience: calculate percent from completed / total.
    pub fn set_progress(&self, done: usize, total: usize, current_file: Option<&str>) {
        let percent = if total == 0 {
            0
        } else {
            ((done as f64 / total as f64) * 100.0) as u8
        };
        self.set_percent(percent, current_file);
    }

    /// Signal that one file in the batch has finished processing.
    pub fn file_done(&self, file: &Path, success: bool) {
        let _ = self.tx.try_send(ProgressUpdate::FileDone {
            file: file.to_path_buf(),
            success,
        });
    }
}
