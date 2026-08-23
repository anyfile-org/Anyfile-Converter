//! Tool commands — expose tool metadata to the frontend.

use tauri::State;

use anyfile_core::ToolMetadata;

use crate::AppState;

/// All registered tools — used by the frontend to build its UI dynamically.
#[tauri::command]
pub async fn list_tools(state: State<'_, AppState>) -> Result<Vec<ToolMetadata>, String> {
    Ok(state.registry.all_metadata())
}

/// Tools that accept a given file extension (e.g. "jpg").
/// Used for "Smart Actions" — showing only relevant operations per file type.
#[tauri::command]
pub async fn tools_for_extension(
    state: State<'_, AppState>,
    extension: String,
) -> Result<Vec<ToolMetadata>, String> {
    Ok(state
        .registry
        .tools_for_extension(&extension)
        .iter()
        .map(|t| t.metadata().clone())
        .collect())
}
