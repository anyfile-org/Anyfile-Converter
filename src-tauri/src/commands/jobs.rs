//! Job commands — thin delegates to [`anyfile_core::JobManager`].
//!
//! Rule: no business logic here. One line per command.

use tauri::{Manager, State};

use anyfile_core::{Job, JobId, JobRequest};

use crate::AppState;

const MAX_HISTORY: usize = 50;
const HISTORY_FILE: &str = "job_history.json";

fn history_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join(HISTORY_FILE)
}

/// Load completed jobs persisted from previous sessions.
pub fn load_history(app: &tauri::AppHandle) -> Vec<Job> {
    let path = history_path(app);
    if !path.exists() {
        return vec![];
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Job>>(&s).ok())
        .unwrap_or_default()
}

/// Persist the last MAX_HISTORY completed jobs to disk.
pub fn persist_history(app: &tauri::AppHandle, jobs: &[Job]) {
    let path = history_path(app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    // Only persist terminal jobs, newest first, cap at MAX_HISTORY
    let mut terminal: Vec<&Job> = jobs
        .iter()
        .filter(|j| {
            matches!(
                j.state,
                anyfile_core::JobState::Completed
                    | anyfile_core::JobState::Failed
                    | anyfile_core::JobState::Cancelled
            )
        })
        .collect();
    terminal.sort_by_key(|j| std::cmp::Reverse(j.created_at));
    terminal.truncate(MAX_HISTORY);

    if let Ok(json) = serde_json::to_string_pretty(&terminal) {
        std::fs::write(&path, json).ok();
    }
}

/// Submit a new job. Returns the JobId immediately.
/// The frontend receives progress via "job-event" Tauri events — no polling.
#[tauri::command]
pub async fn submit_job(state: State<'_, AppState>, request: JobRequest) -> Result<JobId, String> {
    state
        .job_manager
        .submit(request)
        .await
        .map_err(|e| e.to_string())
}

/// Cancel a queued or running job.
#[tauri::command]
pub async fn cancel_job(state: State<'_, AppState>, id: JobId) -> Result<(), String> {
    state
        .job_manager
        .cancel(id)
        .await
        .map_err(|e| e.to_string())
}

/// Get the current state of a specific job.
#[tauri::command]
pub async fn get_job(state: State<'_, AppState>, id: JobId) -> Result<Option<Job>, String> {
    Ok(state.job_manager.get_job(id).await)
}

/// List all jobs (in-memory + loaded history), most recent first.
#[tauri::command]
pub async fn list_jobs(state: State<'_, AppState>) -> Result<Vec<Job>, String> {
    Ok(state.job_manager.list_jobs().await)
}
