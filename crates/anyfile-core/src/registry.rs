use std::{collections::HashMap, sync::Arc};

use crate::tool::{Tool, ToolCategory, ToolMetadata};

/// The central registry of all available tools.
///
/// Tools are registered once at startup via [`anyfile_tools::register_tools`].
/// The registry is then immutable during the application's lifetime.
///
/// # For Contributors
///
/// You do **not** need to modify this struct to add a new tool.
/// Simply implement [`crate::tool::Tool`] and call `registry.register(YourTool::new())`
/// inside `crates/anyfile-tools/src/lib.rs`.
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Register a tool. Called once per tool at startup.
    ///
    /// # Panics
    /// Panics if a tool with the same ID is registered twice.
    /// This catches typos and duplicate registrations at startup, not runtime.
    pub fn register(&mut self, tool: impl Tool + 'static) {
        let id = tool.metadata().id.clone();
        if self.tools.contains_key(&id) {
            panic!("Duplicate tool registration: '{id}'. Each tool ID must be unique.");
        }
        self.tools.insert(id, Arc::new(tool));
    }

    /// Get a tool by its ID.
    pub fn get(&self, id: &str) -> Option<Arc<dyn Tool>> {
        self.tools.get(id).cloned()
    }

    /// All tools that accept a given file extension (case-insensitive).
    pub fn tools_for_extension(&self, ext: &str) -> Vec<Arc<dyn Tool>> {
        let ext_lower = ext.to_lowercase();
        self.tools
            .values()
            .filter(|t| {
                t.metadata()
                    .input_extensions
                    .iter()
                    .any(|e| e == &ext_lower)
            })
            .cloned()
            .collect()
    }

    /// All tools in a given category.
    pub fn tools_for_category(&self, category: &ToolCategory) -> Vec<Arc<dyn Tool>> {
        self.tools
            .values()
            .filter(|t| &t.metadata().category == category)
            .cloned()
            .collect()
    }

    /// Metadata for all registered tools — used by the frontend to build its UI.
    pub fn all_metadata(&self) -> Vec<ToolMetadata> {
        let mut meta: Vec<_> = self.tools.values().map(|t| t.metadata().clone()).collect();
        // Stable ordering: alphabetical by id
        meta.sort_by(|a, b| a.id.cmp(&b.id));
        meta
    }

    /// Number of registered tools.
    pub fn len(&self) -> usize {
        self.tools.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        job::{JobRequest, OutputConfig},
        progress::ProgressReporter,
        tool::{EngineKind, JobOutput, ToolCategory, ToolError, ToolMetadata},
    };
    use anyfile_fs::NamingPattern;
    use std::path::PathBuf;
    use tokio_util::sync::CancellationToken;

    struct FakeTool {
        meta: ToolMetadata,
    }

    #[async_trait::async_trait]
    impl Tool for FakeTool {
        fn metadata(&self) -> &ToolMetadata {
            &self.meta
        }
        fn validate(&self, _: &JobRequest) -> Result<(), ToolError> {
            Ok(())
        }
        async fn execute(
            &self,
            _: &JobRequest,
            _: ProgressReporter,
            _: CancellationToken,
        ) -> Result<JobOutput, ToolError> {
            Ok(JobOutput { output_files: vec![], per_file_errors: vec![] })
        }
    }

    fn make_tool(id: &str, ext: &str) -> FakeTool {
        FakeTool {
            meta: ToolMetadata {
                id: id.to_string(),
                name: id.to_string(),
                description: String::new(),
                category: ToolCategory::Image,
                input_extensions: vec![ext.to_string()],
                output_extension: "out".to_string(),
                requires_engine: EngineKind::BuiltIn,
            },
        }
    }

    #[test]
    fn register_and_retrieve() {
        let mut reg = ToolRegistry::new();
        reg.register(make_tool("image.test", "jpg"));
        assert!(reg.get("image.test").is_some());
        assert!(reg.get("nonexistent").is_none());
    }

    #[test]
    fn tools_for_extension() {
        let mut reg = ToolRegistry::new();
        reg.register(make_tool("image.a", "jpg"));
        reg.register(make_tool("image.b", "png"));
        assert_eq!(reg.tools_for_extension("jpg").len(), 1);
        assert_eq!(reg.tools_for_extension("JPG").len(), 1); // case-insensitive
        assert_eq!(reg.tools_for_extension("gif").len(), 0);
    }

    #[test]
    #[should_panic(expected = "Duplicate tool registration")]
    fn duplicate_registration_panics() {
        let mut reg = ToolRegistry::new();
        reg.register(make_tool("image.test", "jpg"));
        reg.register(make_tool("image.test", "png")); // same ID → panic
    }
}
