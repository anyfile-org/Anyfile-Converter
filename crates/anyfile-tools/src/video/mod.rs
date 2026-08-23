use std::ffi::OsString;

use anyfile_core::{
    job::JobRequest,
    progress::ProgressReporter,
    tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    Tool,
};
use anyfile_engines::ffmpeg::FfmpegEngine;
use anyfile_fs::{validate_input_path, OutputConfig as FsOutputConfig, OutputPath};
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// Extract Audio from Video
// ─────────────────────────────────────────────────────────────────────────────

/// Options for audio extraction — parsed from `request.options`.
#[derive(serde::Deserialize)]
struct ExtractAudioOptions {
    /// Output audio format. Default: "mp3"
    #[serde(default = "default_audio_format")]
    format: String,
}

fn default_audio_format() -> String {
    "mp3".to_string()
}

pub struct ExtractAudio {
    meta: ToolMetadata,
    engine: FfmpegEngine,
}

impl Default for ExtractAudio {
    fn default() -> Self {
        Self::new()
    }
}

impl ExtractAudio {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "video.extract_audio".to_string(),
                name: "Extract Audio".to_string(),
                description: "Extract the audio track from a video file as MP3 or other formats."
                    .to_string(),
                category: ToolCategory::Video,
                input_extensions: vec![
                    "mp4".to_string(),
                    "mkv".to_string(),
                    "avi".to_string(),
                    "mov".to_string(),
                    "webm".to_string(),
                    "flv".to_string(),
                ],
                output_extension: "mp3".to_string(),
                requires_engine: EngineKind::Ffmpeg,
            },
            engine: FfmpegEngine::detect(None),
        }
    }
}

#[async_trait::async_trait]
impl Tool for ExtractAudio {
    fn metadata(&self) -> &ToolMetadata {
        &self.meta
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        // Check engine availability first — surfaces a helpful message before creating the job
        if !self.engine.is_available() {
            return Err(ToolError::EngineNotAvailable(
                "FFmpeg is required to extract audio. Install FFmpeg and ensure it is on your PATH, or set a custom FFmpeg path in Settings.".to_string(),
            ));
        }
        if request.input_files.is_empty() {
            return Err(ToolError::NoInputFiles);
        }
        // Validate options parse
        serde_json::from_value::<ExtractAudioOptions>(request.options.clone())
            .map_err(|e| ToolError::InvalidOptions(e.to_string()))?;
        Ok(())
    }

    async fn execute(
        &self,
        request: &JobRequest,
        progress: ProgressReporter,
        cancel: CancellationToken,
    ) -> Result<JobOutput, ToolError> {
        let opts: ExtractAudioOptions = serde_json::from_value(request.options.clone())
            .unwrap_or_else(|_| ExtractAudioOptions {
                format: "mp3".to_string(),
            });

        let fs_config = FsOutputConfig::from(&request.output_config);
        let total = request.input_files.len();
        let mut output_files = Vec::with_capacity(total);
        let mut per_file_errors = Vec::new();

        for (i, input) in request.input_files.iter().enumerate() {
            if cancel.is_cancelled() {
                return Err(ToolError::Cancelled);
            }

            let file_name = input.file_name().and_then(|n| n.to_str()).unwrap_or("file");
            progress.set_progress(i, total, Some(file_name));

            let validated = validate_input_path(input)
                .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;

            let output_path = OutputPath::resolve(&fs_config, &validated, &opts.format, i)
                .map_err(|e| ToolError::OutputError(e.to_string()))?;

            // Build FFmpeg args: extract audio, no video stream
            // -i <input> -vn -acodec libmp3lame <output>
            let args: Vec<OsString> = vec![
                "-y".into(), // overwrite without asking
                "-i".into(),
                validated.as_os_str().to_os_string(),
                "-vn".into(), // no video
                output_path.path.as_os_str().to_os_string(),
            ];

            let (progress_tx, mut progress_rx) = tokio::sync::mpsc::channel::<u8>(32);

            // Forward FFmpeg progress to our ProgressReporter
            let reporter_clone = progress.clone();
            let total_clone = total;
            let i_clone = i;
            tokio::spawn(async move {
                while let Some(pct) = progress_rx.recv().await {
                    // Scale file progress to overall progress
                    let overall =
                        ((i_clone as f64 + pct as f64 / 100.0) / total_clone as f64 * 100.0) as u8;
                    reporter_clone.set_percent(overall, None);
                }
            });

            let result = self
                .engine
                .run(args, None, Some(progress_tx), cancel.clone())
                .await
                .map_err(|e| {
                    // Differentiate FFmpegNotFound from other errors
                    if matches!(e, anyfile_engines::EngineError::FfmpegNotFound) {
                        ToolError::EngineNotAvailable(e.to_string())
                    } else {
                        ToolError::ProcessingFailed(e.to_string())
                    }
                });

            match result {
                Ok(()) => {
                    output_files.push(output_path.path.clone());
                    progress.file_done(&validated, true);
                }
                Err(ToolError::Cancelled) => return Err(ToolError::Cancelled),
                Err(e) => {
                    per_file_errors.push(anyfile_core::job::PerFileError {
                        input_file: input.clone(),
                        message: e.to_string(),
                    });
                    progress.file_done(&validated, false);
                }
            }
        }

        progress.set_percent(100, None);
        Ok(JobOutput {
            output_files,
            per_file_errors,
        })
    }
}
