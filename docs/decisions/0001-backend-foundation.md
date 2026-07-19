# 0001: Backend foundation boundaries
Date: 2026-07-18
Status: Accepted

## Context
The first backend drop must support a real CLI/GUI fork, typed IPC, strict configuration validation, recoverable registry writes, and a structural ban on arbitrary scripts.

## Decision
The crate is split into pure `core`, thin `api_bridge`, CLI ownership, and a single top-level `winapi_safe` module. The top-level WinAPI module is the dedicated unsafe owner; it is consumed only through the safe `RegistryBackend` trait. Specta owns Rust-to-TypeScript generation. External operations are represented by a closed enum and are not executable until each variant receives a reviewed implementation.

The library emits an `rlib` only: this is a Windows desktop binary, while `cdylib`/`staticlib` outputs are Tauri mobile integration artifacts and trigger a GNU linker export-table failure without serving the product.

## Consequences
Headless mode branches before a Tauri builder exists. Core behavior is mockable without touching HKLM. Adding a Win32 surface or external operation requires an explicit reviewed change in its narrow boundary.

## Alternatives considered
Putting Win32 calls in IPC handlers was rejected because it prevents mocking and violates the ownership boundary. Arbitrary PowerShell strings were rejected because an elevated frontend-to-shell path is an injection primitive.
