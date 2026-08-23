# Third-Party Licenses

AnyFile Convert is built on the shoulders of giants. We are grateful to the authors of the following open-source projects.

## Rust Crates
Most Rust crates used in this project are dual-licensed under MIT and Apache-2.0. Notable dependencies include:
- `tokio` (MIT)
- `tauri` (MIT / Apache-2.0)
- `image` (MIT)
- `lopdf` (MIT)
- `zip` (MIT)

## External Tools
### FFmpeg
AnyFile Convert interacts with FFmpeg for video operations. FFmpeg is licensed under the LGPL-2.1 or later (and GPL depending on compilation flags). We do not currently bundle FFmpeg, but rely on the user providing an executable. When we bundle FFmpeg in the future, it will be compiled specifically to comply with LGPL requirements.

## Frontend
- React (MIT)
- Tailwind CSS (MIT) (if added later)
- Zustand (MIT)
- Lucide Icons (ISC)
