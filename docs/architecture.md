# Architecture

The process parses CLI arguments first. Supplying `--config` enters the headless path and never constructs a Tauri builder; no argument starts the GUI composition root.

- `src-tauri/src/core/` owns validation, tweak orchestration, recovery, declarative catalog loading, and the closed external-operation model. It has no Tauri imports.
- `src-tauri/src/api_bridge/` owns typed `#[tauri::command]` adapters and Specta command collection. It contains no registry or tweak business logic.
- `src-tauri/src/winapi_safe/` is the only module permitted to contain Win32 `unsafe` blocks. Safe core code sees it through `RegistryBackend`.
- `src-tauri/src/cli/` owns clap parsing and headless orchestration, delegating all rules to `core`.
- `src-tauri/src/types.rs` is the DTO source of truth; Specta exports its TypeScript mirror in debug GUI builds.

`TweakDefinition` is the strict catalog contract: localized title/description, category/risk, Windows build and architecture support, elevation requirement, typed detect/apply/restore operations, affected paths, restart metadata, warnings, and Microsoft references. `Provider` separates typed provider operations from orchestration. Its operation result keeps a common provider/operation kind, explanation, warnings, and restart contract while remaining generic over each provider's typed state and recovery payload. `RegistryProvider` is the first implementation; Appx, Service, Scheduled Task, Windows Feature, and Winget can add their own operation/state/recovery types without replacing the plan/recovery shape.

Read-only providers use `InventoryProvider`: `AppxProvider` enumerates live WinRT package metadata and classifies protected/reviewed packages, while `SystemInfoProvider` aggregates OS/build/architecture/admin, pending-restart probes, tweak evidence, recovery history, and package-provider status. Appx removal is preview-only with an explicit blocked-restore result; no uninstall mutation enters the engine until exact restoration is available.

Profiles contain only known tweak IDs plus an explicit enabled/disabled desired state. Built-in and imported profiles compile into `TweakBatchConfig`; manual selections use the same DTO. Planning performs Windows version/build, architecture, and administrator checks before reading or mutating a target. Unsupported definitions report `unsupported` in inventory and are rejected in plan/apply. Provider execution remains inside `TweakEngine`: it records a pending snapshot, executes the typed provider operation, verifies the postcondition, and marks the entry complete.

Every batch is completely deserialized and validated before an engine is created. For every registry action, the current value is read and durably appended to a per-session recovery document before the new value is written. Snapshot entries transition from `pending` to `completed` only after the registry backend reports success.

Recovery replay accepts a session UUID rather than a caller-provided path, opens it inside the configured recovery directory, and replays completed entries in reverse order. A pending entry is replayed only when the live registry value equals its intended target, which reconciles a crash between the registry write and the durable completion marker. Every restore mutation creates its own recovery session, so a restore can itself be reversed.

External process execution is structurally unavailable outside `core/runner/allowlist.rs`. The Application Store uses typed, cancellable allow-list operations; Winget is primary and Chocolatey is an explicit fallback. The only PowerShell path is the separately confirmed, fixed official Chocolatey bootstrap operation—there is no caller-supplied command, URL, argument, or script entry point. Package operations report partial success and are not registry-style reversible.

Normal release, debug, and test builds use `asInvoker`, so per-user tweaks and read-only inventory never trigger UAC. Planning refuses a selected machine-wide tweak when the process is not elevated. A deliberately elevated build can be requested with Cargo feature `elevated`; the future production GUI elevation journey should relaunch only an approved admin plan rather than elevating the whole application at startup.
