//! Settings commands — persist and retrieve user preferences.
//!
//! Settings are stored as `settings.json` in the platform app-data directory.
//! No cloud sync, no account required.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

use crate::analytics::AnalyticsQueue;
use crate::AppState;

/// User-configurable application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// Default output directory. None = same directory as input.
    pub default_output_dir: Option<String>,
    /// Custom FFmpeg binary path. None = auto-detect from PATH.
    pub ffmpeg_path: Option<String>,
    /// Whether to send anonymous usage analytics. Default: false.
    pub analytics_enabled: bool,
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json")
}

/// Load settings from disk. Returns defaults if no settings file exists yet.
#[tauri::command]
pub async fn get_settings(
    _state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<AppSettings, String> {
    let path = settings_path(&app);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
    serde_json::from_str::<AppSettings>(&data).map_err(|e| format!("Failed to parse settings: {e}"))
}

/// Save settings to disk.
#[tauri::command]
pub async fn save_settings(
    _state: State<'_, AppState>,
    analytics_queue: State<'_, std::sync::Arc<AnalyticsQueue>>,
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    let path = settings_path(&app);
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write settings: {e}"))?;
    analytics_queue
        .set_enabled(settings.analytics_enabled)
        .await
        .map_err(|e| format!("Failed to clear queued analytics: {e}"))?;
    Ok(())
}

/// Check whether FFmpeg is available, and return its path + version if so.
#[derive(Debug, Serialize)]
pub struct FfmpegStatusResult {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn get_ffmpeg_status(app: tauri::AppHandle) -> Result<FfmpegStatusResult, String> {
    // Read the current settings to check for custom path
    let settings_path = settings_path(&app);
    let custom_path: Option<PathBuf> = if settings_path.exists() {
        std::fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str::<AppSettings>(&s).ok())
            .and_then(|s| s.ffmpeg_path)
            .map(PathBuf::from)
    } else {
        None
    };

    let engine = anyfile_engines::ffmpeg::FfmpegEngine::detect(custom_path.as_deref());
    Ok(match engine.status() {
        anyfile_engines::ffmpeg::FfmpegStatus::Available { version, path } => FfmpegStatusResult {
            available: true,
            path: Some(path.to_string_lossy().into_owned()),
            version: Some(version),
        },
        anyfile_engines::ffmpeg::FfmpegStatus::NotFound => FfmpegStatusResult {
            available: false,
            path: None,
            version: None,
        },
    })
}
