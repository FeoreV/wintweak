# Streaming Registry Apply

## Goal
Bring registry batch apply to parity with application tasks while preserving validation and durable recovery guarantees.

## Tasks
- [x] Add apply task DTOs, lifecycle storage, safe-boundary cancellation, and ordered progress events in the Rust core.
- [x] Expose start, status, and cancel commands through the thin Tauri/Specta bridge while retaining synchronous CLI apply.
- [x] Regenerate frontend DTO bindings and extend the bridge plus preview mock with staged task progress.
- [x] Poll and render live apply progress, immediate cancelling feedback, partial recovery details, and undo in the review flow.
- [x] Add focused Rust event/cancellation tests and a TypeScript bridge mock test.
- [x] Run the requested frontend and Rust verification commands.

## Done When
- [x] Validation happens before task mutation, cancellation occurs only before a tweak/change, and committed entries remain recoverable.
- [x] EN/RU review locale parity and Rust checks pass; frontend dependency access blockers are documented.

## Notes
- Match the App Store task registry's in-memory lifetime; recovery-document pruning is out of scope.
- Preserve existing synchronous apply for the CLI.
