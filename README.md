# ⚡ Toolify

<p align="center">
  <a href="https://github.com/rajeshc-git/toolify">
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Web-black?style=for-the-badge&logo=apple&logoColor=white" alt="Platforms">
  </a>
  <a href="https://github.com/rajeshc-git/toolify">
    <img src="https://img.shields.io/badge/Runtime-Native%20Swift%20%26%20Electron-blueviolet?style=for-the-badge" alt="Runtimes">
  </a>
  <a href="https://github.com/rajeshc-git/toolify">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
  </a>
  <br>
  <img src="https://img.shields.io/badge/Security-100%25%20Offline%20%26%20Private-success?style=flat-square" alt="Privacy">
  <img src="https://img.shields.io/badge/Zero--Dependency-True-blue?style=flat-square" alt="Dependencies">
</p>

---

**Toolify** is a premium, ultra-fast developer utility toolkit hosting **20 essential diagnostic, compilation, and transformation tools** inside a unified application workspace. Designed for speed, security, and aesthetics, Toolify executes 100% client-side with zero external telemetry or server-side dependencies.

It is distributed as a local web app, a native **macOS Swift Cocoa application**, and a single-file **Windows Portable executable**.

---

## 🎨 Design System & Aesthetics

Toolify is built to look stunning at first glance, featuring:
*   **Monochrome Theme Mappings**: A premium, high-contrast black-and-white theme system that adapts instantly to dark and light mode preferences.
*   **Adaptive Zoom Engine**: A global `80%` scaled canvas rendering layout (`--zoom-level: 0.8`) with automatic proportional heights to fit all laptop and desktop monitors perfectly.
*   **Collapsible Sidebar handle**: A 3D-elevated, floating circular toggle handles centered on the border divider for fluid workspace transitions.

---

## 🛠️ The 20 Utilities Suite

Every tool starts completely clean and empty (no placeholder bloat) with dynamic persistence options:

1.  **🔢 Number Base & Bitwise Converter**: Convert Dec, Hex, Oct, Bin, and UTF-8 characters simultaneously. Includes real-time Two's Complement bound bounds (8/16/32-bit).
2.  **🔑 Password Generator**: Customizable length and charset entropy analysis. Generates only on explicit click.
3.  **📂 Document Analyzer**: Local batch keyword search processing PDF, DOCX, CSV, and text files.
4.  **⏱️ Cron Explainer**: Translates complex cron schedules into plain English descriptors.
5.  **📋 Text Diff Tool**: Line-by-line file and text comparison with detailed additions and deletions highlights.
6.  **🔒 UUID & Hash Generator**: Dynamic UUID generation and cryptographical hash (MD5, SHA-1, SHA-256) calculator.
7.  **📄 PDF Tools**: Split, merge, and convert image formats directly in the browser via `pdf-lib`.
8.  **⚡ HTML & Markdown Sandbox**: Real-time editor and live preview container.
9.  **🛠️ Case & Text Transform**: Convert text blocks to camelCase, snake_case, kebab-case, CONSTANT_CASE, or PascalCase.
10. **🌓 Color Converter**: Interactive hex, rgb, HSL color palette visualizer with WCAG contrast ratios.
11. **🪵 Log Analyzer**: Search, filter, and parse system log lines by error severity levels.
12. **🔑 JWT Decoder**: Client-side JSON Web Token parser displaying header and payload payloads.
13. **📥 URL Encoder/Decoder**: Encode or decode parameters for URL query strings cleanly.
14. **🔄 File to Base64**: Staged local files base64 encoder supporting prefixes.
15. **💿 Base64 to File**: Decodes base64 string assets back into downloadable binary file formats.
16. **📅 Timestamp & Epoch Converter**: Real-time conversion between human dates and Unix milliseconds.
17. **🔍 Regex Tester**: Highlight and match custom regular expression matches in real-time.
18. **📑 JSON Formatter & visualizer**: Expandable tree inspector for nested payloads.
19. **📦 HAR Archive Viewer**: Load and inspect network capture records offline.
20. **🔌 Offline Ready Indicator**: Visual indicator showing local execution status.

---

## 🖥️ Compilation & Standalone Architecture

To run Toolify as a native OS-level application without address bars, browser headers, or tabs, the compilation script bundles all assets into standalone packages:

### 🍏 macOS App Bundle (`Toolify.app` / `Toolify.dmg`)
- **Native compilation**: Compiled using the macOS Swift Compiler (`swiftc`).
- It initiates a native `NSWindow` containing a Cocoa `WKWebView` sandboxed to host the embedded single-file HTML payload.
- Associated with a custom **black-and-white Wrench logo** (`AppIcon.icns`) built using `iconutil`.

### 🪟 Windows Portable Executable (`Toolify.exe`)
- **Electron wrapper**: Packaged using `electron-builder` natively on macOS.
- **Zero node_modules bloat**: Configured via package filters to strip out all devDependencies, bundling **only** `main.js` and `index.html`.
- Compiled as a **Portable App** target: A single standalone `Toolify.exe` file that executes instantly in a borderless Chromium frame on double-click.

---

## ⚙️ Compilation Setup

If you wish to rebuild the standalone releases from the static assets inside `/web`:

### Prerequisites
Make sure you have Xcode Command Line Tools and Node.js installed:
```bash
brew install git-lfs git
git lfs install
```

### Build Command
Run the unified build command to update the macOS app, DMG, and Windows executable:
```bash
# This python utility bundles assets, compiles launcher.swift, packages the Electron EXE, and updates web downloads
python3 -c "import subprocess; # (Run build script)"
```

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
