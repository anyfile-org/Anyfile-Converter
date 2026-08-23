//! FFmpeg engine — wraps FFmpeg as an external subprocess.
//!
//! ## Design Rules
//! - Never construct shell strings. All arguments are passed as `Vec<OsString>`.
//! - Parse FFmpeg's stderr progress output to report live percentage.
//! - Check the cancellation token between output lines and kill the process
//!   if cancelled.
//!
//! ## V0.1 Behaviour
//! FFmpeg is not bundled. The engine searches:
//! 1. The path stored in application settings (user-configured)
//! 2. `PATH` environment variable
//! 3. Common Windows install locations
//!
//! If not found, `FfmpegEngine::status()` returns `EngineStatus::NotFound`
//! and tools will surface a user-facing "Install FFmpeg" message.

use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::mpsc,
};
use tokio_util::sync::CancellationToken;
use tracing::{debug, warn};

use crate::EngineError;

/// Result of an FFmpeg availability check.
#[derive(Debug, Clone)]
pub enum FfmpegStatus {
    Available { version: String, path: PathBuf },
    NotFound,
}

pub struct FfmpegEngine {
    binary_path: Option<PathBuf>,
}

impl FfmpegEngine {
    /// Detect FFmpeg from settings override → PATH → common locations.
    pub fn detect(settings_override: Option<&Path>) -> Self {
        let binary_path = settings_override
            .and_then(|p| {
                if p.exists() {
                    Some(p.to_path_buf())
                } else {
                    None
                }
            })
            .or_else(find_ffmpeg_on_path)
            .or_else(find_ffmpeg_common_locations);

        Self { binary_path }
    }

    pub fn status(&self) -> FfmpegStatus {
        match &self.binary_path {
            Some(path) => {
                // Try to get version string
                let version = std::process::Command::new(path)
                    .arg("-version")
                    .output()
                    .ok()
                    .and_then(|o| String::from_utf8(o.stdout).ok())
                    .and_then(|s| s.lines().next().map(str::to_string))
                    .unwrap_or_else(|| "unknown".to_string());
                FfmpegStatus::Available {
                    version,
                    path: path.clone(),
                }
            }
            None => FfmpegStatus::NotFound,
        }
    }

    pub fn is_available(&self) -> bool {
        self.binary_path.is_some()
    }

    fn binary_path(&self) -> Result<&Path, EngineError> {
        self.binary_path
            .as_deref()
            .ok_or(EngineError::FfmpegNotFound)
    }

    /// Run an FFmpeg command with the given arguments.
    ///
    /// `progress_tx` receives progress updates as u8 percentages (0–100).
    /// Set to `None` if progress reporting is not needed.
    ///
    /// The operation is aborted if `cancel` is triggered.
    pub async fn run(
        &self,
        args: Vec<OsString>,
        duration_hint: Option<Duration>,
        progress_tx: Option<mpsc::Sender<u8>>,
        cancel: CancellationToken,
    ) -> Result<(), EngineError> {
        let binary = self.binary_path()?;

        debug!(
            binary = %binary.display(),
            args = ?args,
            "Spawning FFmpeg"
        );

        let mut child = Command::new(binary)
            .args(&args)
            // FFmpeg writes progress to stderr
            .stderr(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .map_err(|e| EngineError::Ffmpeg(format!("Failed to spawn FFmpeg: {e}")))?;

        let stderr = child.stderr.take().expect("stderr was piped");
        let mut lines = BufReader::new(stderr).lines();

        loop {
            tokio::select! {
                // Check for cancellation
                _ = cancel.cancelled() => {
                    let _ = child.kill().await;
                    return Err(EngineError::Ffmpeg("Operation cancelled".to_string()));
                }

                // Read next line from FFmpeg stderr
                line = lines.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            // Parse "time=HH:MM:SS.ss" for progress
                            if let (Some(tx), Some(total)) = (&progress_tx, duration_hint) {
                                if let Some(percent) = parse_ffmpeg_progress(&line, total) {
                                    let _ = tx.try_send(percent);
                                }
                            }
                        }
                        Ok(None) => break, // EOF — process finished
                        Err(e) => {
                            warn!("Error reading FFmpeg stderr: {e}");
                            break;
                        }
                    }
                }
            }
        }

        let status = child
            .wait()
            .await
            .map_err(|e| EngineError::Ffmpeg(format!("Failed to wait for FFmpeg: {e}")))?;

        if status.success() {
            Ok(())
        } else {
            Err(EngineError::Ffmpeg(format!(
                "FFmpeg exited with status: {}",
                status.code().unwrap_or(-1)
            )))
        }
    }
}

/// Attempt to find ffmpeg on the system PATH.
fn find_ffmpeg_on_path() -> Option<PathBuf> {
    which_ffmpeg("ffmpeg")
}

/// Check common Windows install locations for FFmpeg.
fn find_ffmpeg_common_locations() -> Option<PathBuf> {
    let candidates = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    ];
    candidates.iter().map(PathBuf::from).find(|p| p.exists())
}

fn which_ffmpeg(name: &str) -> Option<PathBuf> {
    std::env::var_os("PATH").and_then(|path_var| {
        std::env::split_paths(&path_var).find_map(|dir| {
            let candidate = dir.join(format!("{name}.exe"));
            if candidate.exists() {
                Some(candidate)
            } else {
                None
            }
        })
    })
}

/// Parse FFmpeg's `time=HH:MM:SS.ss` output into a 0–100 percentage.
fn parse_ffmpeg_progress(line: &str, total: Duration) -> Option<u8> {
    // Look for "time=HH:MM:SS.ss"
    let time_str = line
        .split_whitespace()
        .find_map(|part| part.strip_prefix("time="))?;

    let elapsed_secs = parse_ffmpeg_time(time_str)?;
    let total_secs = total.as_secs_f64();
    if total_secs <= 0.0 {
        return None;
    }
    let percent = ((elapsed_secs / total_secs) * 100.0).min(100.0) as u8;
    Some(percent)
}

/// Parse `HH:MM:SS.ss` into seconds.
fn parse_ffmpeg_time(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: f64 = parts[0].parse().ok()?;
    let minutes: f64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_time_correctly() {
        assert_eq!(parse_ffmpeg_time("00:01:30.00"), Some(90.0));
        assert_eq!(parse_ffmpeg_time("01:00:00.00"), Some(3600.0));
        assert_eq!(parse_ffmpeg_time("00:00:15.50"), Some(15.5));
        assert_eq!(parse_ffmpeg_time("invalid"), None);
    }

    #[test]
    fn progress_percent_calculated() {
        let total = Duration::from_secs(100);
        let line =
            "frame=  100 fps= 25 q=28.0 size=    256kB time=00:00:50.00 bitrate= 41.9kbits/s";
        assert_eq!(parse_ffmpeg_progress(line, total), Some(50));
    }

    #[test]
    fn detect_returns_engine() {
        // Should not panic even when FFmpeg is not installed
        let engine = FfmpegEngine::detect(None);
        // Status is either Available or NotFound — both are valid
        match engine.status() {
            FfmpegStatus::Available { .. } | FfmpegStatus::NotFound => {}
        }
    }
}
