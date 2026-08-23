use std::{
    collections::HashMap,
    sync::Arc,
    time::Instant,
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, mpsc, Mutex, RwLock, Semaphore};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::{
    error::CoreError,
    job::{Job, JobError, JobId, JobProgress, JobRequest, JobResult, JobState},
    progress::{ProgressReporter, ProgressUpdate},
    registry::ToolRegistry,
    tool::ToolError,
};

/// Events emitted by the [`JobManager`] to all subscribers.
///
/// The Tauri command layer subscribes and forwards these as Tauri events
/// to the frontend — no polling required.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum JobEvent {
    JobCreated { id: JobId },
    JobStarted { id: JobId },
    ProgressUpdated { id: JobId, progress: JobProgress },
    JobCompleted { id: JobId, result: JobResult },
    JobFailed { id: JobId, error: JobError },
    JobCancelled { id: JobId },
}

type JobMap = Arc<RwLock<HashMap<JobId, Arc<RwLock<Job>>>>>;
type CancelMap = Arc<Mutex<HashMap<JobId, CancellationToken>>>;

/// Manages the full lifecycle of all jobs.
///
/// - Accepts job submissions from the Tauri command layer
/// - Validates requests using the tool's `validate()` method
/// - Executes jobs concurrently, bounded by a semaphore
/// - Reports live progress via broadcast events
/// - Supports cancellation of running or queued jobs
pub struct JobManager {
    jobs: JobMap,
    cancel_tokens: CancelMap,
    registry: Arc<ToolRegistry>,
    event_tx: broadcast::Sender<JobEvent>,
    /// Limits concurrent jobs to avoid starving the system.
    /// Default: min(4, logical_cpu_count / 2), at least 1.
    semaphore: Arc<Semaphore>,
}

impl JobManager {
    /// Create a new [`JobManager`].
    ///
    /// `max_concurrent` — how many jobs may run simultaneously.
    /// Pass `None` to use the default (CPU-based heuristic).
    pub fn new(registry: Arc<ToolRegistry>, max_concurrent: Option<usize>) -> Self {
        let concurrency = max_concurrent.unwrap_or_else(|| {
            let cpus = num_cpus::get();
            (cpus / 2).max(1).min(4)
        });

        let (event_tx, _) = broadcast::channel(256);

        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
            registry,
            event_tx,
            semaphore: Arc::new(Semaphore::new(concurrency)),
        }
    }

    /// Subscribe to job events.
    ///
    /// The Tauri event bridge calls this once at startup and forwards
    /// events to the frontend via `app.emit()`.
    pub fn subscribe(&self) -> broadcast::Receiver<JobEvent> {
        self.event_tx.subscribe()
    }

    /// Submit a new job request.
    ///
    /// Returns the [`JobId`] immediately. Processing happens asynchronously.
    /// The caller should subscribe to events for progress and completion.
    pub async fn submit(&self, request: JobRequest) -> Result<JobId, CoreError> {
        // 1. Resolve the tool
        let tool = self
            .registry
            .get(&request.tool_id)
            .ok_or_else(|| CoreError::ToolNotFound(request.tool_id.clone()))?;

        // 2. Validate before creating the job record
        tool.validate(&request)?;

        // 3. Create the job record
        let job = Job::new(request.clone());
        let job_id = job.id;
        let job_arc = Arc::new(RwLock::new(job));

        // 4. Store it
        self.jobs.write().await.insert(job_id, job_arc.clone());

        // 5. Create a cancellation token for this job
        let cancel_token = CancellationToken::new();
        self.cancel_tokens
            .lock()
            .await
            .insert(job_id, cancel_token.clone());

        // 6. Emit created event
        self.emit(JobEvent::JobCreated { id: job_id });

        // 7. Spawn the worker
        let jobs = self.jobs.clone();
        let cancel_tokens = self.cancel_tokens.clone();
        let semaphore = self.semaphore.clone();
        let event_tx = self.event_tx.clone();

        tokio::spawn(async move {
            // Acquire semaphore permit — blocks if at concurrency limit
            let _permit = semaphore.acquire().await.expect("Semaphore closed");

            // Check for early cancellation (cancelled while queued)
            if cancel_token.is_cancelled() {
                Self::set_state(&jobs, job_id, JobState::Cancelled).await;
                let _ = event_tx.send(JobEvent::JobCancelled { id: job_id });
                cancel_tokens.lock().await.remove(&job_id);
                return;
            }

            // Mark as running
            {
                let jobs_read = jobs.read().await;
                let mut job = jobs_read.get(&job_id).unwrap().write().await;
                job.state = JobState::Running;
                job.started_at = Some(Utc::now());
            }
            let _ = event_tx.send(JobEvent::JobStarted { id: job_id });

            // Set up progress channel
            let (progress_tx, mut progress_rx) = mpsc::channel::<ProgressUpdate>(64);
            let reporter = ProgressReporter::new(progress_tx, job_id);

            // Spawn progress listener
            let jobs_for_progress = jobs.clone();
            let event_tx_for_progress = event_tx.clone();
            tokio::spawn(async move {
                while let Some(update) = progress_rx.recv().await {
                    match update {
                        ProgressUpdate::Percent { percent, current_file } => {
                            if let Some(job_arc) = jobs_for_progress.read().await.get(&job_id) {
                                let mut job = job_arc.write().await;
                                job.progress.overall_percent = percent;
                                job.progress.current_file = current_file;
                                let progress = job.progress.clone();
                                let _ = event_tx_for_progress.send(JobEvent::ProgressUpdated {
                                    id: job_id,
                                    progress,
                                });
                            }
                        }
                        ProgressUpdate::FileDone { .. } => {
                            if let Some(job_arc) = jobs_for_progress.read().await.get(&job_id) {
                                let mut job = job_arc.write().await;
                                job.progress.files_done += 1;
                                let total = job.progress.files_total;
                                let done = job.progress.files_done;
                                let percent = if total == 0 {
                                    100
                                } else {
                                    ((done as f64 / total as f64) * 100.0) as u8
                                };
                                job.progress.overall_percent = percent;
                                let progress = job.progress.clone();
                                let _ = event_tx_for_progress.send(JobEvent::ProgressUpdated {
                                    id: job_id,
                                    progress,
                                });
                            }
                        }
                    }
                }
            });

            // Execute the tool
            let start = Instant::now();
            let result = tool.execute(&request, reporter, cancel_token.clone()).await;
            let duration_ms = start.elapsed().as_millis() as u64;

            // Update job with result
            {
                let job_arc = jobs.read().await.get(&job_id).cloned();
                if let Some(job_arc) = job_arc {
                    let mut job = job_arc.write().await;
                    job.completed_at = Some(Utc::now());

                    match result {
                        Ok(output) => {
                            let job_result = JobResult {
                                output_files: output.output_files,
                                duration_ms,
                                per_file_errors: output.per_file_errors,
                            };
                            job.state = JobState::Completed;
                            job.progress.overall_percent = 100;
                            job.result = Some(job_result.clone());
                            let _ = event_tx.send(JobEvent::JobCompleted {
                                id: job_id,
                                result: job_result,
                            });
                            info!(job_id = %job_id, duration_ms, "Job completed");
                        }
                        Err(ToolError::Cancelled) => {
                            job.state = JobState::Cancelled;
                            let _ = event_tx.send(JobEvent::JobCancelled { id: job_id });
                            info!(job_id = %job_id, "Job cancelled");
                        }
                        Err(e) => {
                            let job_error = JobError {
                                message: e.to_string(),
                                recoverable: matches!(e, ToolError::EngineNotAvailable(_)),
                            };
                            job.state = JobState::Failed;
                            job.error = Some(job_error.clone());
                            let _ = event_tx.send(JobEvent::JobFailed {
                                id: job_id,
                                error: job_error,
                            });
                            error!(job_id = %job_id, error = %e, "Job failed");
                        }
                    }
                }
            }

            // Clean up cancellation token
            cancel_tokens.lock().await.remove(&job_id);
        });

        Ok(job_id)
    }

    /// Cancel a job that is queued or running.
    pub async fn cancel(&self, id: JobId) -> Result<(), CoreError> {
        let token = self
            .cancel_tokens
            .lock()
            .await
            .get(&id)
            .cloned()
            .ok_or(CoreError::NotCancellable)?;

        // Check the job is in a cancellable state
        if let Some(job_arc) = self.jobs.read().await.get(&id) {
            let state = job_arc.read().await.state.clone();
            if !matches!(state, JobState::Queued | JobState::Running) {
                return Err(CoreError::NotCancellable);
            }
        }

        token.cancel();
        Ok(())
    }

    /// Get a snapshot of a job by ID.
    pub async fn get_job(&self, id: JobId) -> Option<Job> {
        let jobs = self.jobs.read().await;
        if let Some(job_arc) = jobs.get(&id) {
            Some(job_arc.read().await.clone())
        } else {
            None
        }
    }

    /// List all jobs, most recent first.
    pub async fn list_jobs(&self) -> Vec<Job> {
        let jobs = self.jobs.read().await;
        let mut list: Vec<Job> = Vec::new();
        for job_arc in jobs.values() {
            list.push(job_arc.read().await.clone());
        }
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    // --- Private helpers ---

    fn emit(&self, event: JobEvent) {
        // Receivers may be gone (e.g. window closed); that's fine
        let _ = self.event_tx.send(event);
    }

    async fn set_state(jobs: &JobMap, id: JobId, state: JobState) {
        if let Some(job_arc) = jobs.read().await.get(&id) {
            job_arc.write().await.state = state;
        }
    }
}
