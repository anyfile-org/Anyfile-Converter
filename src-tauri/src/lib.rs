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

mod commands;

use std::sync::Arc;

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
        ])
        .setup(|app| {
            // Start the job event bridge on a background task
            let job_manager = app.state::<AppState>().job_manager.clone();
            let app_handle = app.handle().clone();

            tokio::spawn(async move {
                let mut rx = job_manager.subscribe();
                loop {
                    match rx.recv().await {
                        Ok(event) => {
                            // Forward every job event to the frontend
                            if let Err(e) = app_handle.emit("job-event", &event) {
                                tracing::warn!("Failed to emit job event: {e}");
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
