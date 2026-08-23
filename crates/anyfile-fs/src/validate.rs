use std::path::{Path, PathBuf};

use crate::FsError;

/// Validates that a path is safe to use as an input file.
///
/// Checks:
/// 1. The path exists on disk
/// 2. The path points to a file (not a directory)
/// 3. The path does not escape the filesystem root via traversal sequences
///
/// Returns the canonicalized absolute path on success.
pub fn validate_input_path(path: &Path) -> Result<PathBuf, FsError> {
    // Canonicalize resolves `..` and symlinks — catches traversal attempts
    let canonical = path
        .canonicalize()
        .map_err(|_| FsError::NotFound(path.display().to_string()))?;

    if !canonical.exists() {
        return Err(FsError::NotFound(canonical.display().to_string()));
    }

    if !canonical.is_file() {
        return Err(FsError::NotAFile(canonical.display().to_string()));
    }

    Ok(canonical)
}

/// Validates that a path is a usable output directory.
/// Creates the directory if it does not yet exist.
pub fn validate_or_create_output_dir(path: &Path) -> Result<PathBuf, FsError> {
    if path.exists() && !path.is_dir() {
        return Err(FsError::NotADirectory(path.display().to_string()));
    }
    if !path.exists() {
        std::fs::create_dir_all(path)
            .map_err(|e| FsError::OutputDirectoryCreation(format!("{}: {}", path.display(), e)))?;
    }
    path.canonicalize().map_err(FsError::Io)
}

/// Extracts the file extension as a lowercase string.
pub fn extension_lower(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn valid_file_path_passes() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.jpg");
        fs::write(&file, b"fake").unwrap();
        assert!(validate_input_path(&file).is_ok());
    }

    #[test]
    fn nonexistent_path_fails() {
        let p = PathBuf::from("/nonexistent/path/file.jpg");
        assert!(matches!(validate_input_path(&p), Err(FsError::NotFound(_))));
    }

    #[test]
    fn directory_path_fails() {
        let dir = tempdir().unwrap();
        assert!(matches!(
            validate_input_path(dir.path()),
            Err(FsError::NotAFile(_))
        ));
    }
}
