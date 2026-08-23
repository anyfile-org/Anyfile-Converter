# Roadmap

Our goal is to build a comprehensive, privacy-first alternative to cloud-based file tools.

## Phase 1: The Core Experience (V0.1)
- [x] Initial Architecture (Rust + Tauri)
- [x] Job System with real-time UI progress
- [x] 8 foundational operations (Image, PDF, Video, Archive)
- [x] Cancelation support for all tools
- [x] Windows release

## Phase 2: Refinement & Reach (V0.2)
- [ ] Bundle FFmpeg (LGPL compliant) so users don't need to install it manually.
- [ ] Windows Shell Integration (COM/MSIX approach).
- [ ] Add basic audio conversion.
- [ ] Add more image formats (WebP, AVIF).
- [ ] Settings persistence.

## Phase 3: The Power User (V0.3+)
- [ ] Batch processing improvements (queue prioritization).
- [ ] Custom naming patterns for output files.
- [ ] Document conversion (DOCX/PPTX to PDF via LibreOffice).
- [ ] Add `libvips` engine for lightning-fast image batch processing.

## Phase 4: Cross-Platform (V1.0)
- [ ] macOS release (DMG / Homebrew).
- [ ] Linux release (AppImage).
