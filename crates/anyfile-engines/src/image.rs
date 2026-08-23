//! Image engine — wraps the pure-Rust `image` crate.
//!
//! No native DLL required. Handles JPG ↔ PNG conversion and quality-based
//! JPEG compression. For advanced formats (WebP, AVIF, TIFF) see V0.2.

use std::path::Path;

use image::{codecs, DynamicImage, ImageEncoder, ImageFormat};
use tracing::debug;

use crate::EngineError;

pub struct ImageEngine;

impl ImageEngine {
    pub fn new() -> Self {
        Self
    }

    /// Load an image from disk, regardless of its extension.
    pub fn load(&self, path: &Path) -> Result<DynamicImage, EngineError> {
        image::open(path).map_err(|e| EngineError::Image(e.to_string()))
    }

    /// Save an image to disk in the specified format.
    pub fn save(&self, img: &DynamicImage, path: &Path, format: ImageFormat) -> Result<(), EngineError> {
        // Ensure the parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        img.save_with_format(path, format)
            .map_err(|e| EngineError::Image(e.to_string()))
    }

    /// Convert an image file to a different format.
    pub fn convert(
        &self,
        input: &Path,
        output: &Path,
        target_format: ImageFormat,
    ) -> Result<(), EngineError> {
        debug!(input = %input.display(), output = %output.display(), "Converting image");
        let img = self.load(input)?;
        self.save(&img, output, target_format)
    }

    /// Re-encode a JPEG with a given quality (1–100).
    /// Lower quality = smaller file.
    pub fn compress_jpeg(
        &self,
        input: &Path,
        output: &Path,
        quality: u8,
    ) -> Result<(), EngineError> {
        debug!(
            input = %input.display(),
            output = %output.display(),
            quality,
            "Compressing JPEG"
        );
        let img = self.load(input)?;
        let quality = quality.clamp(1, 100);

        // Ensure parent directory
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut file = std::fs::File::create(output)?;
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut file, quality);
        encoder
            .encode_image(&img)
            .map_err(|e| EngineError::Image(e.to_string()))
    }

    /// Re-encode a PNG with a given compression level (0–9).
    /// Higher = smaller file but slower.
    pub fn compress_png(
        &self,
        input: &Path,
        output: &Path,
        compression: image::codecs::png::CompressionType,
    ) -> Result<(), EngineError> {
        debug!(
            input = %input.display(),
            output = %output.display(),
            "Compressing PNG"
        );
        let img = self.load(input)?;

        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = std::fs::File::create(output)?;
        let encoder = image::codecs::png::PngEncoder::new_with_quality(
            file,
            compression,
            image::codecs::png::FilterType::Adaptive,
        );
        encoder
            .write_image(
                img.as_bytes(),
                img.width(),
                img.height(),
                img.color().into(),
            )
            .map_err(|e| EngineError::Image(e.to_string()))
    }
}

impl Default for ImageEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::ImageFormat;
    use tempfile::tempdir;

    fn create_test_jpeg(path: &Path) {
        let img = image::DynamicImage::new_rgb8(64, 64);
        img.save_with_format(path, ImageFormat::Jpeg).unwrap();
    }

    fn create_test_png(path: &Path) {
        let img = image::DynamicImage::new_rgb8(64, 64);
        img.save_with_format(path, ImageFormat::Png).unwrap();
    }

    #[test]
    fn convert_jpeg_to_png() {
        let dir = tempdir().unwrap();
        let input = dir.path().join("test.jpg");
        let output = dir.path().join("test.png");
        create_test_jpeg(&input);

        let engine = ImageEngine::new();
        engine.convert(&input, &output, ImageFormat::Png).unwrap();

        assert!(output.exists());
        // Verify it's actually a valid PNG
        let img = image::open(&output).unwrap();
        assert_eq!(img.width(), 64);
    }

    #[test]
    fn convert_png_to_jpeg() {
        let dir = tempdir().unwrap();
        let input = dir.path().join("test.png");
        let output = dir.path().join("test.jpg");
        create_test_png(&input);

        let engine = ImageEngine::new();
        engine.convert(&input, &output, ImageFormat::Jpeg).unwrap();

        assert!(output.exists());
        let img = image::open(&output).unwrap();
        assert_eq!(img.width(), 64);
    }

    #[test]
    fn compress_jpeg_reduces_quality() {
        let dir = tempdir().unwrap();
        let input = dir.path().join("test.jpg");
        let output_high = dir.path().join("high.jpg");
        let output_low = dir.path().join("low.jpg");

        // Create a non-trivial image (solid colour compresses too well)
        let mut img = image::RgbImage::new(256, 256);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = image::Rgb([(x * y % 255) as u8, (x % 255) as u8, (y % 255) as u8]);
        }
        image::DynamicImage::ImageRgb8(img)
            .save_with_format(&input, ImageFormat::Jpeg)
            .unwrap();

        let engine = ImageEngine::new();
        engine.compress_jpeg(&input, &output_high, 95).unwrap();
        engine.compress_jpeg(&input, &output_low, 20).unwrap();

        let high_size = std::fs::metadata(&output_high).unwrap().len();
        let low_size = std::fs::metadata(&output_low).unwrap().len();
        assert!(low_size < high_size, "Low quality should produce smaller file");
    }
}
