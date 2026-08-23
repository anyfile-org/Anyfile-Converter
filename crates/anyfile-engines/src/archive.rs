//! Archive engine — wraps the pure-Rust `zip` crate.
//!
//! Handles ZIP creation and extraction with security guards:
//! - Extraction refuses to write files outside the output directory (zip slip)
//! - Extraction limits total entry count and uncompressed size

use std::{
    fs, io,
    path::{Component, Path, PathBuf},
};

use tracing::debug;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use crate::EngineError;

/// Maximum number of entries extracted from a single archive.
const MAX_ENTRIES: usize = 10_000;
/// Maximum total uncompressed bytes extracted (4 GB).
const MAX_UNCOMPRESSED_BYTES: u64 = 4 * 1024 * 1024 * 1024;

pub struct ArchiveEngine;

impl ArchiveEngine {
    pub fn new() -> Self {
        Self
    }

    /// Create a ZIP archive from a list of files.
    ///
    /// Files are stored with their base names (no directory structure preserved).
    /// For directory-structure preservation, use `add_directory` (future enhancement).
    pub fn create_zip(&self, inputs: &[&Path], output: &Path) -> Result<(), EngineError> {
        debug!(count = inputs.len(), output = %output.display(), "Creating ZIP");

        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }

        let file = fs::File::create(output)?;
        let mut zip = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for input_path in inputs {
            let file_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| {
                    EngineError::Archive(format!(
                        "Cannot determine file name for: {}",
                        input_path.display()
                    ))
                })?;

            zip.start_file(file_name, options)
                .map_err(|e| EngineError::Archive(e.to_string()))?;

            let mut f = fs::File::open(input_path)?;
            io::copy(&mut f, &mut zip)?;
        }

        zip.finish()
            .map_err(|e| EngineError::Archive(e.to_string()))?;
        Ok(())
    }

    /// Extract a ZIP archive to a directory.
    ///
    /// Security: refuses to extract entries that would write outside `output_dir`
    /// (zip-slip protection). Enforces entry count and size limits.
    pub fn extract_zip(
        &self,
        input: &Path,
        output_dir: &Path,
    ) -> Result<Vec<PathBuf>, EngineError> {
        debug!(
            input = %input.display(),
            output_dir = %output_dir.display(),
            "Extracting ZIP"
        );

        fs::create_dir_all(output_dir)?;

        let file = fs::File::open(input)?;
        let mut archive = ZipArchive::new(file).map_err(|e| EngineError::Archive(e.to_string()))?;

        let entry_count = archive.len();
        if entry_count > MAX_ENTRIES {
            return Err(EngineError::Archive(format!(
                "Archive contains {entry_count} entries, which exceeds the safety limit of {MAX_ENTRIES}"
            )));
        }

        let mut extracted = Vec::new();
        let mut total_bytes: u64 = 0;

        for i in 0..entry_count {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| EngineError::Archive(e.to_string()))?;

            // Zip-slip protection: sanitize the entry name
            let entry_name = entry.name().to_string();
            let safe_path = sanitize_zip_path(output_dir, &entry_name).ok_or_else(|| {
                EngineError::Archive(format!(
                    "Refused to extract '{}': path would escape output directory",
                    entry_name
                ))
            })?;

            if entry.is_dir() {
                fs::create_dir_all(&safe_path)?;
                continue;
            }

            // Check cumulative uncompressed size
            total_bytes += entry.size();
            if total_bytes > MAX_UNCOMPRESSED_BYTES {
                return Err(EngineError::Archive(format!(
                    "Extraction aborted: total uncompressed size exceeds {} GB safety limit",
                    MAX_UNCOMPRESSED_BYTES / 1024 / 1024 / 1024
                )));
            }

            if let Some(parent) = safe_path.parent() {
                fs::create_dir_all(parent)?;
            }

            let mut out_file = fs::File::create(&safe_path)?;
            io::copy(&mut entry, &mut out_file)?;
            extracted.push(safe_path);
        }

        Ok(extracted)
    }
}

impl Default for ArchiveEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve a zip entry name relative to `output_dir`, refusing any path
/// that would escape via `..` or absolute paths.
fn sanitize_zip_path(output_dir: &Path, entry_name: &str) -> Option<PathBuf> {
    let mut path = output_dir.to_path_buf();
    for component in Path::new(entry_name).components() {
        match component {
            Component::Normal(name) => path.push(name),
            Component::CurDir => {}
            // Any attempt to go up or use an absolute root is rejected
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return None;
            }
        }
    }
    Some(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn create_and_extract_roundtrip() {
        let dir = tempdir().unwrap();
        let file_a = dir.path().join("a.txt");
        let file_b = dir.path().join("b.txt");
        fs::write(&file_a, b"hello").unwrap();
        fs::write(&file_b, b"world").unwrap();

        let zip_path = dir.path().join("output.zip");
        let out_dir = dir.path().join("extracted");

        let engine = ArchiveEngine::new();
        engine
            .create_zip(&[file_a.as_path(), file_b.as_path()], &zip_path)
            .unwrap();

        assert!(zip_path.exists());

        let extracted = engine.extract_zip(&zip_path, &out_dir).unwrap();
        assert_eq!(extracted.len(), 2);

        let content_a = fs::read_to_string(out_dir.join("a.txt")).unwrap();
        assert_eq!(content_a, "hello");
    }

    #[test]
    fn zip_slip_rejected() {
        // A path that tries to escape should return None
        assert!(sanitize_zip_path(Path::new("/output"), "../escape.txt").is_none());
        assert!(sanitize_zip_path(Path::new("/output"), "../../etc/passwd").is_none());
        assert!(sanitize_zip_path(Path::new("/output"), "/absolute.txt").is_none());
    }

    #[test]
    fn normal_paths_accepted() {
        let result = sanitize_zip_path(Path::new("/output"), "subdir/file.txt");
        assert!(result.is_some());
        let p = result.unwrap();
        assert!(p.starts_with("/output"));
        assert!(p.ends_with("file.txt"));
    }
}
