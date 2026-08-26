use anyfile_core::{
    job::JobRequest,
    progress::ProgressReporter,
    tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    Tool,
};
use anyfile_engines::pdf::PdfEngine;
use anyfile_fs::{validate_input_path, OutputConfig as FsOutputConfig, OutputPath};
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// PDF Merge
// ─────────────────────────────────────────────────────────────────────────────

pub struct PdfMerge {
    meta: ToolMetadata,
    engine: PdfEngine,
}

impl Default for PdfMerge {
    fn default() -> Self {
        Self::new()
    }
}

impl PdfMerge {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "pdf.merge".to_string(),
                name: "Merge PDFs".to_string(),
                description: "Combine multiple PDF files into one. Pages appear in the order files are provided.".to_string(),
                category: ToolCategory::Pdf,
                input_extensions: vec!["pdf".to_string()],
                output_extension: "pdf".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
            engine: PdfEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for PdfMerge {
    fn metadata(&self) -> &ToolMetadata {
        &self.meta
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        if request.input_files.len() < 2 {
            return Err(ToolError::InvalidOptions(
                "Merging requires at least 2 PDF files.".to_string(),
            ));
        }
        for path in &request.input_files {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext != "pdf" {
                return Err(ToolError::UnsupportedFormat(format!(
                    "Expected PDF, got: .{ext}"
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
        if cancel.is_cancelled() {
            return Err(ToolError::Cancelled);
        }

        progress.set_percent(10, Some("Validating files…"));

        // Validate all inputs
        let mut validated = Vec::new();
        for input in &request.input_files {
            let path = validate_input_path(input)
                .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;
            validated.push(path);
        }

        progress.set_percent(20, Some("Merging PDFs…"));

        let refs: Vec<&std::path::Path> = validated.iter().map(|p| p.as_path()).collect();

        let fs_config = FsOutputConfig::from(&request.output_config);
        let _output_path = OutputPath::resolve(&fs_config, &validated[0], "pdf", 0)
            .map_err(|e| ToolError::OutputError(e.to_string()))?;

        // Use a custom name for merged output
        let merged_name = "merged.pdf";
        let output = request.output_config.directory.join(merged_name);

        self.engine
            .merge(&refs, &output)
            .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;

        progress.set_percent(100, None);

        Ok(JobOutput {
            output_files: vec![output],
            per_file_errors: vec![],
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Split
// ─────────────────────────────────────────────────────────────────────────────

/// Options for PDF split — parsed from `request.options`.
///
/// Two mutually exclusive modes are supported:
/// - Range mode: provide `start_page` and `end_page` to extract a single
///   range of pages into one output file.
/// - Chunk mode: provide `pages_per_split` to break the document into
///   consecutive files of that many pages each (the last file may have
///   fewer pages).
#[derive(serde::Deserialize, Default)]
pub struct SplitOptions {
    /// First page to extract (1-indexed, inclusive). Used in range mode.
    pub start_page: Option<u32>,
    /// Last page to extract (1-indexed, inclusive). Used in range mode.
    pub end_page: Option<u32>,
    /// Number of pages per output file. Used in chunk mode.
    pub pages_per_split: Option<u32>,
}

enum SplitMode {
    Range { start_page: u32, end_page: u32 },
    Chunks { pages_per_split: u32 },
}

impl SplitOptions {
    fn mode(&self) -> Result<SplitMode, ToolError> {
        match (self.start_page, self.end_page, self.pages_per_split) {
            (Some(start_page), Some(end_page), None) => {
                if start_page < 1 || end_page < start_page {
                    return Err(ToolError::InvalidOptions(
                        "start_page must be ≥ 1 and end_page must be ≥ start_page.".to_string(),
                    ));
                }
                Ok(SplitMode::Range { start_page, end_page })
            }
            (None, None, Some(pages_per_split)) => {
                if pages_per_split < 1 {
                    return Err(ToolError::InvalidOptions(
                        "pages_per_split must be at least 1.".to_string(),
                    ));
                }
                Ok(SplitMode::Chunks { pages_per_split })
            }
            _ => Err(ToolError::InvalidOptions(
                "Provide either 'start_page' + 'end_page' (to extract a range) or 'pages_per_split' (to split into fixed-size chunks).".to_string(),
            )),
        }
    }
}

pub struct PdfSplit {
    meta: ToolMetadata,
    engine: PdfEngine,
}

impl Default for PdfSplit {
    fn default() -> Self {
        Self::new()
    }
}

impl PdfSplit {
    pub fn new() -> Self {
        Self {
            meta: ToolMetadata {
                id: "pdf.split".to_string(),
                name: "Split PDF".to_string(),
                description: "Extract a range of pages from a PDF into a new file.".to_string(),
                category: ToolCategory::Pdf,
                input_extensions: vec!["pdf".to_string()],
                output_extension: "pdf".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
            engine: PdfEngine::new(),
        }
    }
}

#[async_trait::async_trait]
impl Tool for PdfSplit {
    fn metadata(&self) -> &ToolMetadata {
        &self.meta
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        if request.input_files.is_empty() {
            return Err(ToolError::NoInputFiles);
        }
        if request.input_files.len() > 1 {
            return Err(ToolError::InvalidOptions(
                "PDF Split operates on one file at a time.".to_string(),
            ));
        }
        let opts =
            serde_json::from_value::<SplitOptions>(request.options.clone()).map_err(|_| {
                ToolError::InvalidOptions(
                    "Split requires either 'start_page'/'end_page' or 'pages_per_split' options."
                        .to_string(),
                )
            })?;
        opts.mode()?;
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

        let opts: SplitOptions = serde_json::from_value(request.options.clone())
            .map_err(|e| ToolError::InvalidOptions(e.to_string()))?;
        let mode = opts.mode()?;

        progress.set_percent(10, Some("Loading PDF…"));

        let input = validate_input_path(&request.input_files[0])
            .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;

        let _fs_config = FsOutputConfig::from(&request.output_config);
        let stem = input
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("split");

        progress.set_percent(30, Some("Extracting pages…"));

        let output_files = match mode {
            SplitMode::Range {
                start_page,
                end_page,
            } => {
                let output_name = format!("{stem}_pages_{start_page}_{end_page}.pdf");
                let output = request.output_config.directory.join(&output_name);
                self.engine
                    .split(&input, &output, start_page, end_page)
                    .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?;
                vec![output]
            }
            SplitMode::Chunks { pages_per_split } => self
                .engine
                .split_by_chunk_size(
                    &input,
                    &request.output_config.directory,
                    stem,
                    pages_per_split,
                )
                .map_err(|e| ToolError::ProcessingFailed(e.to_string()))?,
        };

        progress.set_percent(100, None);

        Ok(JobOutput {
            output_files,
            per_file_errors: vec![],
        })
    }
}
