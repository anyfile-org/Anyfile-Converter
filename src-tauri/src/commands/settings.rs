//! Settings commands — persist and retrieve user preferences.
//!
//! Settings are stored in the platform app data directory via Tauri's
//! path resolver. No cloud sync, no account required.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppState;

/// User-configurable application settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// Default output directory. None = same directory as input.
    pub default_output_dir: Option<String>,
    /// Custom FFmpeg binary path. None = auto-detect from PATH.
    pub ffmpeg_path: Option<String>,
    /// Whether to send anonymous usage analytics. Default: false.
    pub analytics_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_output_dir: None,
            ffmpeg_path: None,
            analytics_enabled: false,  // OFF by default — privacy first
        }
    }
}

/// Load settings from disk. Returns defaults if no settings file exists yet.
#[tauri::command]
pub async fn get_settings(_state: State<'_, AppState>) -> Result<AppSettings, String> {
    // V0.1: returns defaults. Persistence via tauri store plugin is V0.2.
    Ok(AppSettings::default())
}

/// Save settings to disk.
#[tauri::command]
pub async fn save_settings(
    _state: State<'_, AppState>,
    _settings: AppSettings,
) -> Result<(), String> {
    // V0.1: no-op. Persistence via tauri store plugin is V0.2.
    Ok(())
}
