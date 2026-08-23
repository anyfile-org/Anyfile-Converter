# AnyFile Convert

<div align="center">

**The Ultimate Free, Open-Source, Offline Desktop File Converter & Toolbox**

*Securely convert, merge, compress, and process your images, PDFs, videos, and archives entirely on your local machine.*

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/anyfile-converter/Anyfile-Converter/actions/workflows/ci.yml/badge.svg)](https://github.com/anyfile-converter/Anyfile-Converter/actions/workflows/ci.yml)
[![Rust](https://img.shields.io/badge/rust-1.78%2B-orange.svg)](https://www.rust-lang.org)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-blue)](https://github.com/anyfile-converter/Anyfile-Converter/releases)

> **Status: 🚀 Stable Release — v1.0.3**

</div>

---

## 🚀 What is AnyFile Convert?

AnyFile Convert is a powerful, privacy-first desktop application designed to handle all your daily file operations. By processing files **100% locally** on your device, it ensures your sensitive data never leaves your computer. 

Whether you need a **free image converter, offline PDF merger, or video audio extractor**, AnyFile Convert is your all-in-one productivity toolbox for Windows.

- Convert images between formats
- Merge and split PDFs
- Extract audio from video
- Create and extract archives
- Lightning fast native UI powered by React and Vanilla CSS
- Secure background operations with rust-based Job Manager
- Dynamic dark-mode aesthetics
- *(More operations in future releases)*

---

## Why AnyFile Convert?

Most file conversion tools are web apps that upload your files to third-party servers. AnyFile Convert is different:

| Feature | AnyFile Convert | Typical web tools |
|---|---|---|
| Files stay on your device | ✅ Always | ❌ Uploaded to servers |
| Works offline | ✅ Always | ❌ Requires internet |
| No account required | ✅ Never | ❌ Often required |
| Free forever | ✅ Open source | ❌ Freemium limits |
| No file size limits | ✅ Only your disk | ❌ Usually capped |

---

## Supported Operations

### Images ✅ Implemented
| Operation | Status |
|---|---|
| JPG/JPEG → PNG | ✅ v1.0 |
| PNG → JPG | ✅ v1.0 |
| Compress image (JPG, PNG) | ✅ v1.0 |
| WebP conversion | 📋 Planned |
| AVIF support | 📋 Planned |

### PDF ✅ Implemented
| Operation | Status |
|---|---|
| Merge PDFs | ✅ v1.0 |
| Split / extract pages | ✅ v1.0 |
| Compress PDF | 📋 Planned |

### Video
| Operation | Status |
|---|---|
| Extract audio from video | ✅ v1.0 (requires FFmpeg) |
| Convert to MP4 | 📋 Planned |
| Compress video | 📋 Planned |

### Archive ✅ Implemented
| Operation | Status |
|---|---|
| Create ZIP | ✅ v1.0 |
| Extract ZIP | ✅ v1.0 |
| 7-Zip support | 📋 Planned |

### Audio
| Operation | Status |
|---|---|
| Convert audio formats | 📋 Planned |
| Compress / change bitrate | 📋 Planned |

### Documents
| Operation | Status |
|---|---|
| DOCX → PDF | 📋 Planned |
| PPTX → PDF | 📋 Planned |

---

## Installation

> **Note:** v1.0.3 is our latest stable release!

**Windows:**
1. Download `AnyFile.Convert_1.0.3_x64-setup.exe` from the [Releases](https://github.com/anyfile-converter/Anyfile-Converter/releases) page
2. Run the installer
3. AnyFile Convert is ready — no account, no activation

**FFmpeg (for video operations):**
Video operations require FFmpeg. If you don't have it installed, AnyFile Convert will guide you through the setup process when you first try a video operation.

---

## Development Setup

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for full setup instructions.

**Quick start:**

```bash
# Prerequisites: Rust (stable), Node.js 20+, Tauri prerequisites

git clone https://github.com/anyfile-converter/Anyfile-Converter.git
cd Anyfile-Converter
npm install
npm run tauri dev
```

---

## Architecture

AnyFile Convert is built with:
- **Rust** — all file processing, job management, and security
- **Tauri 2.x** — native desktop window, minimal overhead vs Electron
- **React + TypeScript** — user interface

```
React/TypeScript UI
       ↓ Tauri commands
  Rust Application Core
       ↓
  Tool Registry (8 operations in v0.1)
       ↓
  Engine Layer (image crate, lopdf, zip, FFmpeg)
       ↓
  Your local filesystem
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for detailed documentation.

---

## Contributing

We welcome contributions of all kinds — new tools, bug fixes, documentation, translations.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

**Adding a new conversion operation is the best way to start.** It takes 5 steps and does not require touching any existing code. See [Adding Your First Tool](docs/development/adding-a-tool.md).

Good first issues are labelled [`good first issue`](https://github.com/anyfile-converter/Anyfile-Converter/issues?q=label%3A%22good+first+issue%22) on GitHub.

---

## 🔒 Privacy

Your files **never leave your device**. See **[PRIVACY.md](PRIVACY.md)** for the full privacy statement.

---

## 📜 License

AnyFile Convert is licensed under the **GNU General Public License v3.0 or later**.

See **[LICENSE](LICENSE)** for the full text.

Key points:
- You can use it for any purpose — personal, commercial, educational
- You can modify it and redistribute it
- If you distribute a modified version, you must also provide its source code under GPL-3.0
- The copyleft ensures AnyFile Convert remains open source forever

---

## Roadmap

**Phase 1:** Windows MVP (Images, basic PDFs, simple archives)
**Phase 2:** Advanced Video/Audio compression and Metadata tools
**Phase 3:** Full Plugin Architecture
**Phase 4:** macOS Native Support

---

## Contributors

AnyFile Convert is built by its community.

<!-- Add contributors here as the project grows -->

---

<div align="center">

Made with ❤️ and Rust. Privacy first, always.

</div>
