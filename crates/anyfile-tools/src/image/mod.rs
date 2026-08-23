use anyfile_core::{
    job::{JobRequest, PerFileError},
    progress::ProgressReporter,
    tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    Tool,
};
use anyfile_engines::image::ImageEngine;
use anyfile_fs::{validate_input_path, OutputConfig as FsOutputConfig, OutputPath};
use image::ImageFormat;
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// JPG → PNG
// ─────────────────────────────────────────────────────────────────────────────

pub struct JpgToPng {
    meta: ToolMetadata,
    engine: ImageEngine,
}

impl Default for JpgToPng {
    fn default() -> Self {
        Self::new()
    }
}

impl JpgToPng {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "image.jpg_to_png".to_string(),
                name: "Convert JPG → PNG".to_string(),
                description: "Convert JPEG images to lossless PNG format.".to_string(),
                category: ToolCategory::Image,
                input_extensions: vec!["jpg".to_string(), "jpeg".to_string()],
                output_extension: "png".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
            engine: ImageEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for JpgToPng {
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
            if !matches!(ext.as_str(), "jpg" | "jpeg") {
                return Err(ToolError::UnsupportedFormat(format!(
                    "Expected JPG/JPEG, got: .{ext}"
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

            let output_path = OutputPath::resolve(&fs_config, &validated, "png", i)
                .map_err(|e| ToolError::OutputError(e.to_string()))?;

            match self
                .engine
                .convert(&validated, &output_path.path, ImageFormat::Png)
            {
                Ok(()) => {
                    output_files.push(output_path.path.clone());
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
            output_files,
            per_file_errors,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG → JPG
// ─────────────────────────────────────────────────────────────────────────────

pub struct PngToJpg {
    meta: ToolMetadata,
    engine: ImageEngine,
}

impl Default for PngToJpg {
    fn default() -> Self {
        Self::new()
    }
}

impl PngToJpg {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "image.png_to_jpg".to_string(),
                name: "Convert PNG → JPG".to_string(),
                description: "Convert PNG images to JPEG format. Note: PNG transparency is lost."
                    .to_string(),
                category: ToolCategory::Image,
                input_extensions: vec!["png".to_string()],
                output_extension: "jpg".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
            engine: ImageEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for PngToJpg {
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
            if ext != "png" {
                return Err(ToolError::UnsupportedFormat(format!(
                    "Expected PNG, got: .{ext}"
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

            let output_path = OutputPath::resolve(&fs_config, &validated, "jpg", i)
                .map_err(|e| ToolError::OutputError(e.to_string()))?;

            match self
                .engine
                .convert(&validated, &output_path.path, ImageFormat::Jpeg)
            {
                Ok(()) => {
                    output_files.push(output_path.path.clone());
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
            output_files,
            per_file_errors,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Compress
// ─────────────────────────────────────────────────────────────────────────────

/// Options for image compression — parsed from `request.options`.
#[derive(serde::Deserialize)]
struct CompressOptions {
    /// JPEG quality (1–100). Default: 75.
    #[serde(default = "default_jpeg_quality")]
    jpeg_quality: u8,
}

fn default_jpeg_quality() -> u8 {
    75
}

pub struct ImageCompress {
    meta: ToolMetadata,
    engine: ImageEngine,
}

impl Default for ImageCompress {
    fn default() -> Self {
        Self::new()
    }
}

impl ImageCompress {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "image.compress".to_string(),
                name: "Compress Image".to_string(),
                description: "Reduce image file size. Supports JPG and PNG.".to_string(),
                category: ToolCategory::Image,
                input_extensions: vec!["jpg".to_string(), "jpeg".to_string(), "png".to_string()],
                output_extension: "compressed".to_string(), // overridden per file below
                requires_engine: EngineKind::BuiltIn,
            },
            engine: ImageEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for ImageCompress {
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
            if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
                return Err(ToolError::UnsupportedFormat(format!(
                    "Compress supports JPG and PNG, got: .{ext}"
                )));
            }
        }
        // Validate options parse
        serde_json::from_value::<CompressOptions>(request.options.clone())
            .map_err(|e| ToolError::InvalidOptions(e.to_string()))?;
        Ok(())
    }

    async fn execute(
        &self,
        request: &JobRequest,
        progress: ProgressReporter,
        cancel: CancellationToken,
    ) -> Result<JobOutput, ToolError> {
        let opts: CompressOptions = serde_json::from_value(request.options.clone())
            .unwrap_or(CompressOptions { jpeg_quality: 75 });

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

            let ext = validated
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("jpg")
                .to_lowercase();
            let output_path = OutputPath::resolve(&fs_config, &validated, &ext, i)
                .map_err(|e| ToolError::OutputError(e.to_string()))?;

            let result = match ext.as_str() {
                "jpg" | "jpeg" => {
                    self.engine
                        .compress_jpeg(&validated, &output_path.path, opts.jpeg_quality)
                }
                "png" => self.engine.compress_png(
                    &validated,
                    &output_path.path,
                    image::codecs::png::CompressionType::Best,
                ),
                _ => Err(anyfile_engines::EngineError::Image(
                    "Unsupported format".to_string(),
                )),
            };

            match result {
                Ok(()) => {
                    output_files.push(output_path.path.clone());
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
            output_files,
            per_file_errors,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyfile_core::job::{JobRequest, OutputConfig};
    use anyfile_fs::NamingPattern;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn make_request(tool_id: &str, files: Vec<PathBuf>, dir: PathBuf) -> JobRequest {
        JobRequest {
            tool_id: tool_id.to_string(),
            input_files: files,
            output_config: OutputConfig {
                directory: dir,
                overwrite: true,
                naming: NamingPattern::SameNameNewExtension,
            },
            options: serde_json::Value::Null,
        }
    }

    fn make_jpeg(path: &std::path::Path) {
        image::DynamicImage::new_rgb8(32, 32)
            .save_with_format(path, image::ImageFormat::Jpeg)
            .unwrap();
    }

    fn make_png(path: &std::path::Path) {
        image::DynamicImage::new_rgb8(32, 32)
            .save_with_format(path, image::ImageFormat::Png)
            .unwrap();
    }

    #[tokio::test]
    async fn jpg_to_png_converts_file() {
        let dir = tempdir().unwrap();
        let input = dir.path().join("test.jpg");
        make_jpeg(&input);

        let out_dir = dir.path().join("out");
        let tool = JpgToPng::new();
        let request = make_request("image.jpg_to_png", vec![input.clone()], out_dir.clone());

        assert!(tool.validate(&request).is_ok());

        let (tx, _rx) = tokio::sync::mpsc::channel(16);
        let reporter = anyfile_core::progress::ProgressReporter::new(tx, uuid::Uuid::new_v4());
        let cancel = CancellationToken::new();

        let result = tool.execute(&request, reporter, cancel).await.unwrap();
        assert_eq!(result.output_files.len(), 1);
        assert!(result.output_files[0].exists());
        assert_eq!(
            result.output_files[0].extension().and_then(|e| e.to_str()),
            Some("png")
        );
    }

    #[tokio::test]
    async fn png_to_jpg_converts_file() {
        let dir = tempdir().unwrap();
        let input = dir.path().join("test.png");
        make_png(&input);

        let out_dir = dir.path().join("out");
        let tool = PngToJpg::new();
        let request = make_request("image.png_to_jpg", vec![input.clone()], out_dir);

        let (tx, _rx) = tokio::sync::mpsc::channel(16);
        let reporter = anyfile_core::progress::ProgressReporter::new(tx, uuid::Uuid::new_v4());
        let cancel = CancellationToken::new();

        let result = tool.execute(&request, reporter, cancel).await.unwrap();
        assert!(result.output_files[0].exists());
        assert_eq!(
            result.output_files[0].extension().and_then(|e| e.to_str()),
            Some("jpg")
        );
    }

    #[test]
    fn validate_rejects_wrong_extension() {
        let tool = JpgToPng::new();
        let dir = tempdir().unwrap();
        let request = make_request(
            "image.jpg_to_png",
            vec![PathBuf::from("test.png")],
            dir.path().to_path_buf(),
        );
        assert!(tool.validate(&request).is_err());
    }
}
