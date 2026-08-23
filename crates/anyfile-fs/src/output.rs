use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::FsError;

/// Controls how output files are named relative to inputs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NamingPattern {
    /// Same name as input, different extension: `photo.jpg` → `photo.png`
    SameNameNewExtension,
    /// Appends a suffix before the extension: `photo.jpg` → `photo_compressed.jpg`
    AppendSuffix(String),
    /// Uses a fixed base name with a counter for batches: `output_001.png`
    Numbered { base: String },
}

/// Configuration for where and how output files are written.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    /// Directory where output files are written.
    pub directory: PathBuf,
    /// If true, overwrite existing output files; otherwise error.
    pub overwrite: bool,
    /// How output file names are derived from input file names.
    pub naming: NamingPattern,
}

impl OutputConfig {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            overwrite: false,
            naming: NamingPattern::SameNameNewExtension,
        }
    }
}

/// A resolved output path for a single file.
#[derive(Debug, Clone)]
pub struct OutputPath {
    pub path: PathBuf,
}

impl OutputPath {
    /// Compute the output path for a given input file and target extension.
    pub fn resolve(
        config: &OutputConfig,
        input: &Path,
        output_extension: &str,
        index: usize,
    ) -> Result<Self, FsError> {
        let stem = input
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");

        let file_name = match &config.naming {
            NamingPattern::SameNameNewExtension => {
                format!("{}.{}", stem, output_extension)
            }
            NamingPattern::AppendSuffix(suffix) => {
                format!("{}_{}.{}", stem, suffix, output_extension)
            }
            NamingPattern::Numbered { base } => {
                format!("{}_{:03}.{}", base, index + 1, output_extension)
            }
        };

        let mut path = config.directory.join(file_name);

        // Handle collision when overwrite is disabled
        if !config.overwrite && path.exists() {
            let mut counter = 1u32;
            loop {
                let stem_with_counter =
                    format!("{}_{}.{}", path.file_stem().unwrap().to_string_lossy(), counter, output_extension);
                let candidate = config.directory.join(stem_with_counter);
                if !candidate.exists() {
                    path = candidate;
                    break;
                }
                counter += 1;
            }
        }

        Ok(OutputPath { path })
    }
}
