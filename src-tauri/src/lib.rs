//! AnyFile Convert — Tauri application library root.
//!
//! This file:
//! 1. Builds the [`AppState`] (registry + job manager)
//! 2. Registers all Tauri commands
//! 3. Starts the job event bridge (Rust broadcast → Tauri frontend events)
//! 4. Runs the Tauri application
//!
//! ## Architecture Rule
//! No business logic lives here. This is pure wiring.

pub mod analytics;
mod commands;
pub mod registry;

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyfile_core::{JobManager, ToolRegistry};
use anyfile_tools::register_tools;
use tauri::{Emitter, Manager};
use tracing::info;

/// Shared application state — injected into every Tauri command.
pub struct AppState {
    pub registry: Arc<ToolRegistry>,
    pub job_manager: Arc<JobManager>,
}

/// Called from `main.rs`. Builds the app and runs it.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialise structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "anyfile=debug,warn".into()),
        )
        .init();

    // Build tool registry
    let mut registry = ToolRegistry::new();
    register_tools(&mut registry);
    info!("Registered {} tools", registry.len());

    let registry = Arc::new(registry);
    let job_manager = Arc::new(JobManager::new(registry.clone(), None));

    let state = AppState {
        registry: registry.clone(),
        job_manager: job_manager.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::jobs::submit_job,
            commands::jobs::cancel_job,
            commands::jobs::get_job,
            commands::jobs::list_jobs,
            commands::tools::list_tools,
            commands::tools::tools_for_extension,
            commands::settings::get_settings,
            commands::settings::save_settings,
            get_startup_file,
        ])
        .setup(|app| {
            // Register Windows context menu (silently ignore errors if not admin/supported)
            if let Err(e) = registry::register_context_menu() {
                tracing::warn!("Failed to register context menu: {}", e);
            }

            // Setup Analytics Queue
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir).ok();
            }

            let analytics_queue = Arc::new(analytics::AnalyticsQueue::new(app_data_dir));
            analytics::AnalyticsQueue::start_worker(analytics_queue.clone());

            // Start the job event bridge on a background task
            let job_manager = app.state::<AppState>().job_manager.clone();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let mut rx = job_manager.subscribe();
                loop {
                    match rx.recv().await {
                        Ok(event) => {
                            // Forward every job event to the frontend
                            if let Err(e) = app_handle.emit("job-event", &event) {
                                tracing::warn!("Failed to emit job event: {e}");
                            }

                            // If it's a completed event, push to analytics
                            if let anyfile_core::JobEvent::JobCompleted { id: _, result: _ } =
                                &event
                            {
                                // Real app would read settings here to check if analytics is enabled.
                                // For MVP, we assume true or you'd pass a settings state.
                                let a_event = analytics::AnalyticsEvent {
                                    event: "operation_completed".to_string(),
                                    category: "tool".to_string(),
                                    operation: "job".to_string(), // In full implementation, we'd look up the tool name from the job
                                    platform: "windows".to_string(),
                                    app_version: app_handle.package_info().version.to_string(),
                                    timestamp: SystemTime::now()
                                        .duration_since(UNIX_EPOCH)
                                        .unwrap()
                                        .as_secs(),
                                };
                                let q = analytics_queue.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = q.push(a_event).await;
                                });
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("Job event bridge lagged by {n} messages");
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            break;
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Failed to run AnyFile Convert");
}

#[tauri::command]
fn get_startup_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    // Look for "--file <path>"
    for i in 0..args.len() {
        if args[i] == "--file" && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }
    None
}
