# Architecture

The process parses CLI arguments first. Supplying `--config` enters the headless path and never constructs a Tauri builder; no argument starts the GUI composition root.

- `src-tauri/src/core/` owns validation, tweak orchestration, recovery, declarative catalog loading, and the closed external-operation model. It has no Tauri imports.
- `src-tauri/src/api_bridge/` owns typed `#[tauri::command]` adapters and Specta command collection. It contains no registry or tweak business logic.
- `src-tauri/src/winapi_safe/` is the only module permitted to contain Win32 `unsafe` blocks. Safe core code sees it through `RegistryBackend`.
- `src-tauri/src/cli/` owns clap parsing and headless orchestration, delegating all rules to `core`.
- `src-tauri/src/types.rs` is the DTO source of truth; Specta exports its TypeScript mirror in debug GUI builds.

`TweakDefinition` is the strict catalog contract: localized title/description, category/risk, Windows build and architecture support, elevation requirement, typed detect/apply/restore operations, affected paths, restart metadata, warnings, and Microsoft references. `Provider` separates typed provider operations from orchestration; `RegistryProvider` is the first implementation, while Appx, Service, Scheduled Task, Windows Feature, and Winget remain closed future provider kinds.

Profiles contain only known tweak IDs plus an explicit enabled/disabled desired state. Built-in and imported profiles compile into `TweakBatchConfig`; manual selections use the same DTO. Planning performs Windows version/build, architecture, and administrator checks before reading or mutating a target. Unsupported definitions report `unsupported` in inventory and are rejected in plan/apply. Provider execution remains inside `TweakEngine`: it records a pending snapshot, executes the typed provider operation, verifies the postcondition, and marks the entry complete.

Every batch is completely deserialized and validated before an engine is created. For every registry action, the current value is read and durably appended to a per-session recovery document before the new value is written. Snapshot entries transition from `pending` to `completed` only after the registry backend reports success.

Recovery replay accepts a session UUID rather than a caller-provided path, opens it inside the configured recovery directory, and replays completed entries in reverse order. A pending entry is replayed only when the live registry value equals its intended target, which reconciles a crash between the registry write and the durable completion marker. Every restore mutation creates its own recovery session, so a restore can itself be reversed.

External process execution is structurally unavailable outside `core/runner/allowlist.rs`. The Application Store uses typed, cancellable allow-list operations; Winget is primary and Chocolatey is an explicit fallback. The only PowerShell path is the separately confirmed, fixed official Chocolatey bootstrap operation—there is no caller-supplied command, URL, argument, or script entry point. Package operations report partial success and are not registry-style reversible.

Release builds embed `requireAdministrator`. Debug/test builds use the default manifest so automated tests never trigger UAC; a debug elevation smoke build can be requested with Cargo feature `elevated`.
