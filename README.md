# WinTweak AI

A Windows 10/11 desktop utility for reviewing, applying, and restoring selected system tweaks. Every change is validated before execution, shown to the user before approval, and recorded for recovery.

> Pre-release: use only in a test environment until the catalog and installer are production-ready.

## Features

- Rust core shared by the Tauri GUI and headless CLI.
- Typed plan, apply, status, recovery, and restore operations.
- Four documented registry tweaks with durable recovery records.
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
optimizer.exe --config data\example.batch.json --dry-run
optimizer.exe --list-recovery
optimizer.exe --restore <SESSION_ID>
```

## Documentation

- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/decisions)
- [Roadmap](docs/roadmap.md)
