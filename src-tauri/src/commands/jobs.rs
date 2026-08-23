//! Job commands — thin delegates to [`anyfile_core::JobManager`].
//!
//! Rule: no business logic here. One line per command.

use tauri::State;

use anyfile_core::{Job, JobId, JobRequest};

use crate::AppState;

/// Submit a new job. Returns the JobId immediately.
/// The frontend receives progress via "job-event" Tauri events — no polling.
#[tauri::command]
pub async fn submit_job(
    state: State<'_, AppState>,
    request: JobRequest,
) -> Result<JobId, String> {
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

/// List all jobs, most recent first.
#[tauri::command]
pub async fn list_jobs(state: State<'_, AppState>) -> Result<Vec<Job>, String> {
    Ok(state.job_manager.list_jobs().await)
}
