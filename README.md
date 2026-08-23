# AnyFile Convert

<div align="center">

**A free, open-source, privacy-first, offline-first desktop file toolbox.**

*iLovePDF — but for your entire computer, completely offline.*

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/anyfile-convert/anyfile-convert/actions/workflows/ci.yml/badge.svg)](https://github.com/anyfile-convert/anyfile-convert/actions/workflows/ci.yml)
[![Rust](https://img.shields.io/badge/rust-1.78%2B-orange.svg)](https://www.rust-lang.org)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-blue)](https://github.com/anyfile-convert/anyfile-convert/releases)

> **Status: 🚧 Active Development — v0.1.0 not yet released**

</div>

---

## What is AnyFile Convert?

AnyFile Convert processes your files **entirely on your device**. No uploads. No accounts. No internet required.

It is a single application for common file operations that normal users need every day:

- Convert images between formats
- Merge and split PDFs
- Extract audio from video
- Create and extract archives
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
| JPG/JPEG → PNG | ✅ v0.1 |
| PNG → JPG | ✅ v0.1 |
| Compress image (JPG, PNG) | ✅ v0.1 |
| WebP conversion | 📋 Planned |
| AVIF support | 📋 Planned |

### PDF ✅ Implemented
| Operation | Status |
|---|---|
| Merge PDFs | ✅ v0.1 |
| Split / extract pages | ✅ v0.1 |
| Compress PDF | 📋 Planned |

### Video
| Operation | Status |
|---|---|
| Extract audio from video | ✅ v0.1 (requires FFmpeg) |
| Convert to MP4 | 📋 Planned |
| Compress video | 📋 Planned |

### Archive ✅ Implemented
| Operation | Status |
|---|---|
| Create ZIP | ✅ v0.1 |
| Extract ZIP | ✅ v0.1 |
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

> **Note:** v0.1.0 is not yet released. This section will be updated when the first installer is available.

**Windows:**
1. Download `AnyFileConvert-Setup.exe` from the [Releases](https://github.com/anyfile-convert/anyfile-convert/releases) page
2. Run the installer
3. AnyFile Convert is ready — no account, no activation

**FFmpeg (for video operations):**
Video operations require FFmpeg. If you don't have it installed, AnyFile Convert will guide you through the setup process when you first try a video operation.

---

## Development Setup

See **[DEVELOPMENT.md](DEVELOPMENT.md)** for full setup instructions.

**Quick start:**

```bash
# Prerequisites: Rust (stable), Node.js 20+, Tauri prerequisites

git clone https://github.com/anyfile-convert/anyfile-convert.git
cd anyfile-convert
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

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed documentation.

---

## Contributing

We welcome contributions of all kinds — new tools, bug fixes, documentation, translations.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

**Adding a new conversion operation is the best way to start.** It takes 5 steps and does not require touching any existing code. See [Adding Your First Tool](docs/development/adding-a-tool.md).

Good first issues are labelled [`good first issue`](https://github.com/anyfile-convert/anyfile-convert/issues?q=label%3A%22good+first+issue%22) on GitHub.

---

## Privacy

Your files **never leave your device**. See **[PRIVACY.md](PRIVACY.md)** for the full privacy statement.

---

## Security

To report a security vulnerability, see **[SECURITY.md](SECURITY.md)**.

Do **not** open a public GitHub issue for security vulnerabilities.

---

## License

AnyFile Convert is licensed under the **GNU General Public License v3.0 or later**.

See **[LICENSE](LICENSE)** for the full text.

Key points:
- You can use it for any purpose — personal, commercial, educational
- You can modify it and redistribute it
- If you distribute a modified version, you must also provide its source code under GPL-3.0
- The copyleft ensures AnyFile Convert remains open source forever

Third-party dependency licenses: **[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)**

---

## Roadmap

See **[ROADMAP.md](ROADMAP.md)** for the full development roadmap.

---

## Contributors

AnyFile Convert is built by its community.

<!-- Add contributors here as the project grows -->

---

<div align="center">

Made with ❤️ and Rust. Privacy first, always.

</div>
