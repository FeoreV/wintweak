# Project roadmap

## Roadmap

- Milestone 1: verify the foundation on MSVC CI and run the headless path on Windows Server Core.
- Milestone 2: validate the React advisor, apply, and undo journey in a real elevated Windows VM.
- Milestone 3: add Appx, Service, Scheduled Task, Windows Feature, and Winget implementations to the typed provider boundary.

## Backlog

- Signed declarative plugins.
- Signed declarative catalog extensions with provenance verification.

## Technical debt

- Recovery documents do not yet have retention or pruning rules. Reason: preserve all audit/recovery evidence during foundation development. Cost of delay: recovery storage grows with each mutation session.

## Completed work

- 2026-07-18 — Added the React 19 Fluent interface, EN/RU localization, deterministic local advisor, exact plan review, apply, and session undo flow.

- 2026-07-18 — Created the buildable Tauri v2 backend foundation with CLI/GUI fork, tracing, strict DTOs, Specta bindings, typed IPC, registry abstraction, atomic recovery snapshots, and an external-operation allow-list.
- 2026-07-18 — Replaced foundation markers with four Microsoft-documented registry policy tweaks and a matching four-tweak headless example batch.
- 2026-07-18 — Completed crash-aware recovery replay through core, CLI, and typed IPC, including reverse-order replay, missing-value deletion, pending-write reconciliation, and mock-registry tests.
- 2026-07-19 — Added the typed provider/catalog vertical slice: ten reversible Microsoft-documented registry tweaks, five exact profiles, environment-gated dry-run, enabled/disabled/mixed/unsupported/unknown inventory, profile CLI import/export, UI filters/profile preview/diff/progress/history, and recovery-aware provider execution.

## Future ideas

- Feature-flagged ISO builder.
- ARM64 builds.

## Performance metrics

- No release benchmark recorded yet.

## Security notes

- Raw PowerShell and arbitrary caller-provided scripts are prohibited structurally; see ADR 0001.

## Release notes

- Unreleased 0.1.0: backend foundation and GUI advisor vertical slice.
