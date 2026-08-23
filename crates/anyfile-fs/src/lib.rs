//! Filesystem utilities for AnyFile Convert.
//!
//! Responsible for:
//! - Path validation and canonicalization
//! - Preventing path traversal attacks
//! - Output path generation and naming
//! - Temporary file lifecycle management

pub mod error;
pub mod output;
pub mod temp;
pub mod validate;

pub use error::FsError;
pub use output::{NamingPattern, OutputConfig, OutputPath};
pub use temp::TempFileGuard;
pub use validate::validate_input_path;
