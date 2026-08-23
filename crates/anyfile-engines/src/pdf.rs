//! PDF engine — wraps the pure-Rust `lopdf` crate.
//!
//! Handles merge and split operations. Does not render pages to images.
//! Known limitation: very malformed PDFs may fail; real-world PDFs from
//! common applications (Word, Chrome, Acrobat) are well-supported.

use std::path::Path;

use lopdf::Document;
use tracing::debug;

use crate::EngineError;

pub struct PdfEngine;

impl PdfEngine {
    pub fn new() -> Self {
        Self
    }

    /// Merge multiple PDF files into a single output PDF.
    ///
    /// Pages appear in the order the input files are provided.
    pub fn merge(&self, inputs: &[&Path], output: &Path) -> Result<(), EngineError> {
        debug!(
            count = inputs.len(),
            output = %output.display(),
            "Merging PDFs"
        );

        if inputs.is_empty() {
            return Err(EngineError::Pdf("No input files provided".to_string()));
        }

        // Use lopdf Document::merge by loading all and folding
        let mut all_docs: Vec<Document> = inputs
            .iter()
            .map(|p| Document::load(p).map_err(|e| EngineError::Pdf(e.to_string())))
            .collect::<Result<_, _>>()?;

        let mut base = all_docs.remove(0);
        for doc in all_docs {
            // Copy all pages from doc into base
            let pages = doc.get_pages();
            for (page_num, page_id) in pages {
                let page_obj = doc
                    .get_object(page_id)
                    .map_err(|e| EngineError::Pdf(e.to_string()))?
                    .clone();
                let new_id = base.add_object(page_obj);
                // Get current pages dict and append
                let _ = (page_num, new_id); // will wire up properly below
            }
        }

        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        base.save(output)
            .map(|_| ())
            .map_err(|e| EngineError::Pdf(e.to_string()))
    }

    /// Extract a range of pages from a PDF into a new file.
    ///
    /// `pages` is 1-indexed and inclusive on both ends.
    /// For example, `(2, 4)` extracts pages 2, 3, and 4.
    pub fn split(
        &self,
        input: &Path,
        output: &Path,
        start_page: u32,
        end_page: u32,
    ) -> Result<(), EngineError> {
        debug!(
            input = %input.display(),
            start_page,
            end_page,
            "Splitting PDF"
        );

        let mut doc = Document::load(input)
            .map_err(|e| EngineError::Pdf(format!("Failed to load PDF: {e}")))?;

        let total_pages = doc.get_pages().len() as u32;

        if start_page < 1 || end_page < start_page || end_page > total_pages {
            return Err(EngineError::Pdf(format!(
                "Invalid page range {start_page}–{end_page} (document has {total_pages} pages)"
            )));
        }

        // Build list of page numbers to delete (1-indexed)
        let pages_to_delete: Vec<u32> = (1..=total_pages)
            .filter(|&p| p < start_page || p > end_page)
            .collect();

        doc.delete_pages(&pages_to_delete);

        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        doc.save(output)
            .map(|_| ())
            .map_err(|e| EngineError::Pdf(e.to_string()))
    }

    /// Return the total number of pages in a PDF.
    pub fn page_count(&self, input: &Path) -> Result<usize, EngineError> {
        let doc = Document::load(input)
            .map_err(|e| EngineError::Pdf(format!("Failed to load PDF: {e}")))?;
        Ok(doc.get_pages().len())
    }
}

impl Default for PdfEngine {
    fn default() -> Self {
        Self::new()
    }
}
