# WinTweak Functionality Audit

Date: 2026-07-20

## Overview & Current State

This audit evaluates the live functionality of WinTweak across Tauri 2 backend (Rust), IPC Bridge, and React 19 Frontend.

---

## Component Audit

### 1. Home Workspace (`src/components/HomePage.tsx`)
- **Current State**:
  - Displays basic `SystemAudit` data (`EnvironmentCheck`, pending restart reasons, recovery session count, Appx package count).
  - Contains a "System Health Score" / "Optimization Score" calculated as the percentage of enabled tweaks vs total tweaks.
  - **Gaps / Deficiencies**:
    - Optimization score misrepresents system health (enabling tweaks is not a universal proxy for system health).
    - Missing Hardware inventory: CPU model/cores, Total RAM, GPU adapters, System volumes (total/free space, low disk warning), Uptime/last boot.
    - Missing device metadata: Computer name, manufacturer, model.
    - Missing summary counters for installed apps, available package updates, driver updates.

### 2. Optimize Workspace (`src/components/OptimizePage.tsx`)
- **Current State**:
  - Live connection to backend tweak catalog (`list_tweaks`), tweak statuses (`get_tweak_statuses`), and apply batch engine (`start_apply_batch`, `get_apply_operation`).
  - Batch planning and execution with progress bar and pending change review.
  - **Gaps / Deficiencies**:
    - UI currently relies on hardcoded category tabs and filter logic.
    - Needs dynamic category rendering from backend catalog DTOs.
    - Needs additional reviewed, fully reversible per-user tweaks with strict JSON schema validation and provenance links to Microsoft documentation.

### 3. Drivers Workspace (`src/components/DriversPage.tsx`)
- **Current State**:
  - Calls `get_driver_inventory` which executes `Win32_PnPSignedDriver` WMI query and `Microsoft.Update.Session` COM search via PowerShell allow-list wrapper (`DRIVER_INVENTORY_SCRIPT`).
  - Calls `install_driver_update` to download & install driver updates via Windows Update Agent COM.
  - **Gaps / Deficiencies**:
    - Inventory load can be slow on certain machines due to COM WMI search. Needs clean loading/error/reboot states.
    - Requires robust handling of partial search errors, WSUS/offline policies, and device deduplication.

### 4. Apps Workspace (`src/components/AppsPage.tsx`)
- **Current State**:
  - Displays curated `AppDefinition` catalog (Winget / Chocolatey packages).
  - Can check Winget & Chocolatey provider availability and run batch installation/upgrades via process allow-list.
  - Supports explicit Chocolatey bootstrap flow.
  - **Gaps / Deficiencies**:
    - Does NOT distinguish between **Installed Apps** (real device inventory) and **App Store** (package catalog).
    - Lacks native Win32 Uninstall registry inventory (HKLM/HKCU 32/64-bit) combined with Appx packages and provider package states.
    - Needs unified `InstalledApp` DTO and ambiguity-safe package ID matching.

---

## Backend & IPC Architecture Verification
- **Rust DTOs (`src-tauri/src/types.rs`)**:
  - Specta annotations guarantee TypeScript synchronization (`src/types/backend.generated.ts`).
  - All process invocations are bound inside `src-tauri/src/core/runner/allowlist.rs` with strict parameter validation and fixed command arguments.
- **Safety Boundaries**:
  - Zero raw command execution from user input or frontend.
  - Every registry tweak requires `detect`, `apply`, and exact pre-state snapshot `restore` definitions.
