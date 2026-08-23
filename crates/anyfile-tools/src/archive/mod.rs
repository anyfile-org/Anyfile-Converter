use anyfile_core::{
    job::{JobRequest, PerFileError},
    progress::ProgressReporter,
    tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    Tool,
};
use anyfile_engines::archive::ArchiveEngine;
use anyfile_fs::validate_input_path;
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// Create ZIP
// ─────────────────────────────────────────────────────────────────────────────

pub struct CreateZip {
    meta: ToolMetadata,
    engine: ArchiveEngine,
}

impl Default for CreateZip {
    fn default() -> Self {
        Self::new()
    }
}

impl CreateZip {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "archive.create_zip".to_string(),
                name: "Create ZIP".to_string(),
                description: "Compress one or more files into a ZIP archive.".to_string(),
                category: ToolCategory::Archive,
                // Accepts any file type
                input_extensions: vec![], // empty = all extensions accepted
                output_extension: "zip".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
            engine: ArchiveEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for CreateZip {
    fn metadata(&self) -> &ToolMetadata {
        &self.meta
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        if request.input_files.is_empty() {
            return Err(ToolError::NoInputFiles);
        }
        Ok(())
    }

    async fn execute(
        &self,
        request: &JobRequest,
        progress: ProgressReporter,
        cancel: CancellationToken,
    ) -> Result<JobOutput, ToolError> {
        if cancel.is_cancelled() {
            return Err(ToolError::Cancelled);
        }

        progress.set_percent(10, Some("Validating files…"));

        let mut validated = Vec::new();
        for input in &request.input_files {
            let path = validate_input_path(input)
                .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;
            validated.push(path);
        }

        progress.set_percent(20, Some("Creating archive…"));

        let refs: Vec<&std::path::Path> = validated.iter().map(|p| p.as_path()).collect();
        let output = request.output_config.directory.join("archive.zip");

        self.engine
            .create_zip(&refs, &output)
            .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;

        progress.set_percent(100, None);

        Ok(JobOutput {
            output_files: vec![output],
            per_file_errors: vec![],
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract ZIP
// ─────────────────────────────────────────────────────────────────────────────

pub struct ExtractZip {
    meta: ToolMetadata,
    engine: ArchiveEngine,
}

impl Default for ExtractZip {
    fn default() -> Self {
        Self::new()
    }
}

impl ExtractZip {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "archive.extract_zip".to_string(),
                name: "Extract ZIP".to_string(),
                description: "Extract the contents of a ZIP archive to a folder.".to_string(),
                category: ToolCategory::Archive,
                input_extensions: vec!["zip".to_string()],
                output_extension: "".to_string(), // produces a directory, not a single file
                requires_engine: EngineKind::BuiltIn,
            },
            engine: ArchiveEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for ExtractZip {
    fn metadata(&self) -> &ToolMetadata {
        &self.meta
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        if request.input_files.is_empty() {
            return Err(ToolError::NoInputFiles);
        }
        for path in &request.input_files {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext != "zip" {
                return Err(ToolError::UnsupportedFormat(format!(
                    "Expected ZIP, got: .{ext}"
                )));
            }
        }
        Ok(())
    }

    async fn execute(
        &self,
        request: &JobRequest,
        progress: ProgressReporter,
        cancel: CancellationToken,
    ) -> Result<JobOutput, ToolError> {
        let total = request.input_files.len();
        let mut all_extracted = Vec::new();
        let mut per_file_errors = Vec::new();

        for (i, input) in request.input_files.iter().enumerate() {
            if cancel.is_cancelled() {
                return Err(ToolError::Cancelled);
            }

            let file_name = input.file_name().and_then(|n| n.to_str()).unwrap_or("file");
            progress.set_progress(i, total, Some(file_name));

            let validated = validate_input_path(input)
                .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;

            // Create a named subdirectory for each archive's contents
            let stem = validated
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("extracted");
            let out_dir = request.output_config.directory.join(stem);

            match self.engine.extract_zip(&validated, &out_dir) {
                Ok(extracted) => {
                    all_extracted.extend(extracted);
                    progress.file_done(&validated, true);
                }
                Err(e) => {
                    per_file_errors.push(PerFileError {
                        input_file: input.clone(),
                        message: e.to_string(),
                    });
                    progress.file_done(&validated, false);
                }
            }
        }

        progress.set_percent(100, None);
        Ok(JobOutput {
            output_files: all_extracted,
            per_file_errors,
        })
    }
}
