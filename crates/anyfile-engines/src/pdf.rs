//! PDF engine — wraps the pure-Rust `lopdf` crate.
//!
//! Handles merge and split operations. Does not render pages to images.
//! Known limitation: very malformed PDFs may fail; real-world PDFs from
//! common applications (Word, Chrome, Acrobat) are well-supported.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use lopdf::{Document, Object, ObjectId};
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

        let documents: Vec<Document> = inputs
            .iter()
            .map(|p| Document::load(p).map_err(|e| EngineError::Pdf(e.to_string())))
            .collect::<Result<_, _>>()?;

        let mut merged = Self::merge_documents(documents)?;

        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        merged
            .save(output)
            .map(|_| ())
            .map_err(|e| EngineError::Pdf(e.to_string()))
    }

    /// Combine already-loaded documents into a single `Document`, properly
    /// rebuilding the page tree (Kids/Count) and catalog so every page from
    /// every input actually shows up in the output — not just the first
    /// document's pages.
    fn merge_documents(mut documents: Vec<Document>) -> Result<Document, EngineError> {
        if documents.is_empty() {
            return Err(EngineError::Pdf("No input files provided".to_string()));
        }

        let mut max_id = 1;
        let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
        let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();

        for doc in documents.iter_mut() {
            doc.renumber_objects_with(max_id);
            max_id = doc.max_id + 1;

            documents_pages.extend(
                doc.get_pages()
                    .into_values()
                    .map(|object_id| {
                        (
                            object_id,
                            doc.get_object(object_id).unwrap().to_owned(),
                        )
                    })
                    .collect::<BTreeMap<ObjectId, Object>>(),
            );
            documents_objects.extend(doc.objects.clone());
        }

        let mut document = Document::with_version("1.5");
        let mut catalog_object: Option<(ObjectId, Object)> = None;
        let mut pages_object: Option<(ObjectId, Object)> = None;

        for (object_id, object) in documents_objects.iter() {
            match object.type_name().unwrap_or("") {
                "Catalog" => {
                    catalog_object = Some((
                        catalog_object.map_or(*object_id, |(id, _)| id),
                        object.clone(),
                    ));
                }
                "Pages" => {
                    if let Ok(dictionary) = object.as_dict() {
                        let mut dictionary = dictionary.clone();
                        if let Some((_, ref old_object)) = pages_object {
                            if let Ok(old_dictionary) = old_object.as_dict() {
                                dictionary.extend(old_dictionary);
                            }
                        }
                        pages_object = Some((
                            pages_object.as_ref().map_or(*object_id, |(id, _)| *id),
                            Object::Dictionary(dictionary),
                        ));
                    }
                }
                "Page" => {
                    // Individual page objects are re-inserted below via
                    // documents_pages so that Kids can reference them.
                }
                "Outlines" | "Outline" => {
                    // Drop original bookmarks/outlines; not essential for a merge.
                }
                _ => {
                    document.objects.insert(*object_id, object.clone());
                }
            }
        }

        let catalog_object =
            catalog_object.ok_or_else(|| EngineError::Pdf("No catalog found while merging PDFs".to_string()))?;
        let pages_object =
            pages_object.ok_or_else(|| EngineError::Pdf("No page tree found while merging PDFs".to_string()))?;

        // Re-insert every page object, fixing its Parent to point at the
        // single merged Pages node.
        for (object_id, object) in documents_pages.iter() {
            let mut object = object.clone();
            if let Ok(dictionary) = object.as_dict_mut() {
                dictionary.set("Parent", pages_object.0);
            }
            document.objects.insert(*object_id, object);
        }

        // Rebuild the Pages node with Count/Kids covering every input page.
        if let Ok(dictionary) = pages_object.1.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Count", documents_pages.len() as u32);
            dictionary.set(
                "Kids",
                documents_pages
                    .keys()
                    .map(|object_id| Object::Reference(*object_id))
                    .collect::<Vec<_>>(),
            );
            document.objects.insert(pages_object.0, Object::Dictionary(dictionary));
        }

        // Point the catalog at the merged Pages node and drop any dangling
        // Outlines reference from the source documents.
        if let Ok(dictionary) = catalog_object.1.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Pages", pages_object.0);
            dictionary.remove(b"Outlines");
            document.objects.insert(catalog_object.0, Object::Dictionary(dictionary));
        }

        document.trailer.set("Root", catalog_object.0);
        document.max_id = document.objects.len() as u32;
        document.renumber_objects();
        document.adjust_zero_pages();
        document.compress();

        Ok(document)
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

    /// Split a PDF into multiple files, each containing up to `chunk_size`
    /// consecutive pages. Returns the list of output paths created, in order.
    ///
    /// `chunk_size` must be ≥ 1. The output files are named by appending
    /// `_part_{n}` before the extension of `output_stem`.
    pub fn split_by_chunk_size(
        &self,
        input: &Path,
        output_dir: &Path,
        stem: &str,
        chunk_size: u32,
    ) -> Result<Vec<PathBuf>, EngineError> {
        if chunk_size < 1 {
            return Err(EngineError::Pdf(
                "chunk_size must be at least 1".to_string(),
            ));
        }

        debug!(
            input = %input.display(),
            chunk_size,
            "Splitting PDF into chunks"
        );

        let total_pages = self.page_count(input)? as u32;
        if total_pages == 0 {
            return Err(EngineError::Pdf("PDF has no pages".to_string()));
        }

        std::fs::create_dir_all(output_dir)?;

        let mut outputs = Vec::new();
        let mut part = 1;
        let mut start_page = 1;
        while start_page <= total_pages {
            let end_page = (start_page + chunk_size - 1).min(total_pages);

            let mut doc = Document::load(input)
                .map_err(|e| EngineError::Pdf(format!("Failed to load PDF: {e}")))?;
            let pages_to_delete: Vec<u32> = (1..=total_pages)
                .filter(|&p| p < start_page || p > end_page)
                .collect();
            doc.delete_pages(&pages_to_delete);

            let output_path = output_dir.join(format!("{stem}_part_{part}.pdf"));
            doc.save(&output_path)
                .map_err(|e| EngineError::Pdf(e.to_string()))?;
            outputs.push(output_path);

            part += 1;
            start_page = end_page + 1;
        }

        Ok(outputs)
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
