# Adding a New Tool to AnyFile Convert

This is a step-by-step guide on how to add a new file conversion or processing tool to AnyFile Convert. Our architecture is designed so that you can add new tools without touching the UI, the Tauri bridge, or the core job runner.

## 5 Simple Steps

### Step 1: Set up your environment
Follow the instructions in `DEVELOPMENT.md` to get your local environment running.

### Step 2: Create the tool file
Create a new file in the appropriate category folder inside `crates/anyfile-tools/src/`.
For example, to add an AVIF to PNG converter, create `crates/anyfile-tools/src/image/avif_to_png.rs`.

### Step 3: Implement the `Tool` trait
Your new file should implement the `Tool` trait from `anyfile_core`.

```rust
use anyfile_core::{
    job::JobRequest,
    progress::ProgressReporter,
    tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    Tool,
};
use async_trait::async_trait;
use tokio_util::sync::CancellationToken;
use std::path::PathBuf;

pub struct AvifToPng {
    metadata: ToolMetadata,
}

impl AvifToPng {
    pub fn new() -> Self {
        Self {
            metadata: ToolMetadata {
                id: "image.avif_to_png".to_string(),
                name: "Convert AVIF to PNG".to_string(),
                description: "Lossless conversion from AVIF to PNG format".to_string(),
                category: ToolCategory::Image,
                input_extensions: vec!["avif".to_string()],
                output_extension: "png".to_string(),
                requires_engine: EngineKind::ImageCrate, // Or Libvips, etc.
            },
        }
    }
}

#[async_trait]
impl Tool for AvifToPng {
    fn metadata(&self) -> &ToolMetadata {
        &self.metadata
    }

    fn validate(&self, request: &JobRequest) -> Result<(), ToolError> {
        // Simple checks (e.g. at least one file, valid extensions)
        if request.input_files.is_empty() {
            return Err(ToolError::ValidationError("No input files provided".into()));
        }
        Ok(())
    }

    async fn execute(
        &self,
        request: &JobRequest,
        progress: ProgressReporter,
        cancel: CancellationToken,
    ) -> Result<JobOutput, ToolError> {
        // Implement the conversion logic here.
        // Remember to check `cancel.is_cancelled()` inside any loops!
        // Remember to call `progress.file_done(...)` after each file.

        Ok(JobOutput {
            output_files: vec![],
            duration_ms: 0,
            per_file_errors: vec![],
        })
    }
}
```

### Step 4: Register the tool
Open `crates/anyfile-tools/src/lib.rs` and add your tool to the `register_tools` function:

```rust
// In crates/anyfile-tools/src/lib.rs
pub fn register_tools(registry: &mut ToolRegistry) {
    // ...
    registry.register(AvifToPng::new());
}
```

### Step 5: Test and PR
Write a quick unit test in your tool's file using one of the fixtures in `tests/fixtures/`.
Once it passes, push your branch and open a Pull Request! The UI will automatically discover your tool and display it when a user drops an `.avif` file.
