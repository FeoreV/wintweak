# 0005: App Store process boundary and explicit Chocolatey bootstrap

## Context

The Application Store executes package-manager commands and therefore has a wider trust boundary than registry tweaks. Earlier prototype code launched `winget`, `choco`, and a downloaded Chocolatey PowerShell script directly from catalog orchestration.

## Decision

All process creation is owned by `core/runner/allowlist.rs`. Operations are a closed Rust enum; application data and IPC cannot select an executable, add flags, or provide a script. Winget is primary. Chocolatey is an optional provider only for catalog entries that declare a Chocolatey package ID.

Chocolatey bootstrap is a separate typed operation requiring `acknowledged_remote_script: true`. It uses the fixed official Chocolatey endpoint and never resumes a pending install automatically. This is the sole runtime network exception beyond user-opened links.

Package tasks expose task IDs, typed progress state, final reports, and cancellation between package launches. Package operations are not rollbackable like registry tweaks.

## Consequences

The UI must obtain explicit consent before bootstrap and present partial success/cancellation. New providers require reviewed enum variants and tests. The source-tree test enforces the process and unsafe boundaries.
