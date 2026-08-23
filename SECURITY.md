# Security Policy

## Supported Versions
Only the latest released version of AnyFile Convert receives security updates.

## Reporting a Vulnerability

**DO NOT open a public GitHub issue to report a security vulnerability.**

Instead, please email security concerns directly to the maintainers at: `security@anyfileconvert.local` (Note: update email before final release).

Please include:
* A description of the vulnerability.
* Steps to reproduce it.
* The version of AnyFile Convert affected.

We aim to acknowledge reports within 48 hours and provide a timeline for a fix.

## Our Security Model
AnyFile Convert is a local application running with the user's standard permissions. We follow the principle of least privilege in our Tauri configuration, restricting file system access to user-selected directories where possible.

We use mature, well-tested underlying engines (like FFmpeg and pure-Rust libraries) to minimize parsing vulnerabilities. We also prevent "Zip Slip" vulnerabilities by validating all extracted paths.
