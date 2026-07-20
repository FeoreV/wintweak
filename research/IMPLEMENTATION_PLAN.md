# Implementation Plan: Live Windows Data & Functional UX/UI

Date: 2026-07-20

## Roadmap of Vertical Slices

### Slice 1: Baseline & Branch Setup (Completed)
- Switch to dedicated branch `feature/live-windows-data` while preserving uncommitted UI work.
- Verify TypeScript (`pnpm typecheck`) and Vitest (`pnpm test`) baselines.

### Slice 2: System Summary & Home Page Real Windows Data
- **Rust Backend**:
  - Add native Windows hardware provider in `src-tauri/src/winapi_safe/mod.rs` & `system_info.rs`:
    - System identity: computer name, OS edition/version/build/arch, manufacturer, model, elevation mode.
    - Hardware: CPU model, logical cores, Total/Available RAM (GB).
    - GPU: Adapter names.
    - Disks/Volumes: Total capacity, free space, low disk space indicator (< 10%).
    - Uptime: Days/hours from `GetTickCount64`.
    - Real summary counts: installed apps count, driver updates count, package updates count.
  - Update `SystemAudit` DTO in `types.rs` with Specta export.
  - Update `get_system_audit` IPC command.
- **Frontend**:
  - Update `HomePage.tsx` to display live computer info, hardware stats, disk meters, uptime, and transparent system overview counters.
  - Remove fake "Optimization / System Health Score".

### Slice 3: Installed Apps Inventory & App Store Separation
- **Rust Backend**:
  - Implement native installed Win32 applications inventory in `src-tauri/src/core/apps.rs`:
    - Read `HKLM` & `HKCU` Uninstall registry keys (both 64-bit and 32-bit WOW6432Node views).
    - Extract DisplayName, DisplayVersion, Publisher, InstallLocation, InstallDate, UninstallString.
    - Deduplicate against native Appx package inventory (`AppxProvider`).
    - Exclude system components / Windows updates entries.
  - Define `InstalledApp` DTO in `types.rs`.
  - Add IPC command `list_installed_apps()`.
- **Frontend**:
  - Split `AppsPage.tsx` into two tabs: **Installed** (real device apps with source badges `registry`, `appx`, `winget`, `choco`) and **App Store** (browsable catalog & updates).
  - Implement real-time filtering, search, and package matching.

### Slice 4: App Store & Package Updates Integration
- **Rust Backend**:
  - Match installed apps with catalog/winget/choco package IDs safely.
  - Implement Winget & Chocolatey updates detection.
- **Frontend**:
  - Display available package updates with multi-select update action.
  - Show real-time progress and provider status.

### Slice 5: Drivers Hardening & Async Operations
- **Rust Backend & Allow-list**:
  - Enhance `DriverInventory` error handling and non-blocking background query.
  - Support reboot required state and update validation before install.
- **Frontend**:
  - Update `DriversPage.tsx` with clear empty/loading/error/reboot states and search refresh.

### Slice 6: Tweak Catalog Schema Validation & Dynamic UI
- **Rust Backend**:
  - Add catalog schema validation tests (`built_in_catalog()`).
  - Add safe, reversible Explorer/Privacy tweaks with exact restore snapshots and Microsoft Learn documentation links.
- **Frontend**:
  - Derive category tabs and filter options dynamically from catalog `TweakDefinition` data (no hardcoded category lists in React).

### Slice 7: i18n & Accessibility Audit
- Ensure all user-facing strings pass through `src/i18n/locales/en.json` and `ru.json`.
- Verify keyboard navigation, screen reader labels, and focus indicators.

### Slice 8: Final Verification & Evidence
- Run full test suite: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `cargo fmt`, `cargo check`, `cargo test`.
