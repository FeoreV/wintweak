# 0002: Crash-aware recovery replay
Date: 2026-07-18
Status: Accepted

## Context
Registry state must be captured before every mutation, but a process can stop between persisting that snapshot, performing the Win32 write, and recording success. Treating every captured entry as completed can overwrite unrelated state when replaying a write that never occurred; ignoring every unconfirmed entry can make a write that reached the registry non-restorable.

## Decision
Each snapshot entry is durably written as `pending` before registry mutation and changed to `completed` after the backend reports success. Restore processes entries in reverse order. Completed entries are always replayed. A pending entry is replayed only when its live value equals the entry's intended target, indicating that the interrupted write reached the registry. Legacy entries without a state field deserialize as completed. Restore accepts only a UUID and resolves it as a sibling of the new recovery session, never as a caller-controlled path.

Every restore write follows the same pending/completed protocol and therefore creates a separate recovery session that can reverse the restore itself.

## Consequences
Normal sessions restore deterministically in reverse order, including deletion when the original value was absent. Crashes before a registry write no longer cause a later restore to overwrite the current value. The narrow crash window after a successful write is reconciled from live state. If another actor independently changes a pending value to exactly the intended target, replay cannot distinguish that change from the interrupted operation; the audit log still exposes the pending state.

## Alternatives considered
Treating all pre-write entries as completed was rejected because failed writes would appear restorable. Ignoring all pending entries was rejected because a successful write followed by a crash before the completion marker would be lost. A transaction spanning JSON storage and the Windows registry is unavailable, so live-state reconciliation is the narrowest approach that preserves the existing dependency and WinAPI boundaries.
