# WinTweak

A Windows 10/11 desktop utility for reviewing, applying, and restoring selected system tweaks. Every change is validated before execution, shown to the user before approval, and recorded for recovery.

> Pre-release: use only in a test environment until the catalog and installer are production-ready.

## Features

- Rust core shared by the Tauri GUI and headless CLI.
- Typed plan, apply, status, recovery, and restore operations.
- Eleven reversible Microsoft-documented registry tweaks with durable recovery records.
- Typed provider catalog, five exact profiles, environment-gated dry-run, progress, and restore history.
- Local, deterministic recommendations for privacy, development, and distraction reduction.
- English and Russian interface with light, dark, and reduced-motion support.
- Reviewed application-installation allow-list for Winget and Chocolatey.

## Requirements

- Windows 10 or 11
- Node.js 24 and pnpm 11.9
- Rust stable MSVC with `rustfmt` and `clippy`
- Visual Studio Build Tools with the Desktop development with C++ workload
- WebView2 Runtime

## Development

```powershell
pnpm install
pnpm dev
pnpm tauri dev
```

Run native commands from a Visual Studio Developer PowerShell. The project rejects the GNU Rust host.

## Quality checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build

Set-Location src-tauri
cargo fmt --all -- --check
cargo check --all-targets --locked
cargo clippy --all-targets --locked -- -D warnings
cargo test --all-targets --locked
```

## CLI

```powershell
optimizer.exe --list-tweaks
optimizer.exe --status
optimizer.exe --inventory
optimizer.exe --audit
optimizer.exe --diagnostics
optimizer.exe --app-catalog
optimizer.exe --config data\example.batch.json --dry-run
optimizer.exe --profile privacy --dry-run
optimizer.exe --profile balanced --apply
optimizer.exe --profile developer --export-profile developer.json
optimizer.exe --import-profile developer.json --dry-run
optimizer.exe --list-recovery
optimizer.exe --restore <SESSION_ID>
```

Imported profiles are strict JSON containing catalog IDs and explicit `enabled`/`disabled` desired states. They cannot contain executables, arguments, scripts, URLs, or registry paths. Applying any profile compiles it to the same exact plan/review/apply/recovery pipeline as a manual selection.

Normal builds run as the current user. Per-user tweaks do not require elevation; a plan containing a machine-wide policy is refused unless WinTweak was explicitly launched elevated. For an elevation smoke build use `cargo build --features elevated`. A scoped approve-and-relaunch GUI journey remains the next Windows-validation task.

## Safety and attribution

The catalog uses Microsoft documentation as the normative source. Public MIT projects including Win11Debloat and ChrisTitusTech/winutil informed product-level catalog and workflow ideas; no source code or prose was copied. GPL/AGPL implementations, arbitrary PowerShell, caller-provided shell commands, component removal, Windows Update/Defender disabling, and irreversible debloat are intentionally excluded.

The higher-impact entries are `reduce_diagnostic_data` and `disable_activity_history` (moderate risk); they change machine policy and may require a reboot or logoff. Widgets and taskbar alignment are per-user Windows 11 settings and may require an Explorer restart. Mouse acceleration changes pointer feel. Every committed registry write snapshots the exact previous value before mutation.

Appx inventory uses the native WinRT `PackageManager`. Framework, resource, shell, Store, installer, and security packages are protected; only a small reviewed optional-app set receives a removal preview. Removal apply is intentionally blocked because exact reinstall/registration cannot yet be guaranteed by recovery.

## Documentation

- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/decisions)
- [Roadmap](docs/roadmap.md)
- [Research sources and provenance](docs/research-sources.md)
