//! Stable, serializable errors shared by the core, CLI, and IPC adapters.

use serde::Serialize;
use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Type)]
#[serde(tag = "code", content = "details", rename_all = "snake_case")]
pub enum AppError {
    #[error("configuration is invalid: {message}")]
    InvalidConfigSchema { message: String },
    #[error("tweak '{tweak_id}' does not exist")]
    UnknownTweak { tweak_id: String },
    #[error("application '{app_id}' does not exist")]
    UnknownApplication { app_id: String },
    #[error("registry access was denied for '{path}'")]
    RegistryAccessDenied { path: String },
    #[error("registry operation failed for '{path}': {message} (Win32 {raw_code})")]
    RegistryOperation {
        path: String,
        message: String,
        raw_code: u32,
    },
    #[error("recovery snapshot operation failed: {message}")]
    RecoverySnapshot { message: String },
    #[error("recovery session '{session_id}' was not found")]
    RecoverySessionNotFound { session_id: String },
    #[error("registry value at '{path}' has unsupported type {raw_type}")]
    UnsupportedRegistryValue { path: String, raw_type: u32 },
    #[error("external operation is not permitted: {operation}")]
    OperationNotAllowed { operation: String },
    #[error("external process failed: {message}")]
    ExternalProcessFailed { message: String },
    #[error("this operation requires Windows")]
    UnsupportedPlatform,
    #[error("Tauri failed: {message}")]
    Tauri { message: String },
    #[error("TypeScript type export failed: {message}")]
    TypeExport { message: String },
    #[error("I/O failed while handling '{path}': {message}")]
    Io { path: String, message: String },
}

impl AppError {
    /// Converts an I/O error while retaining the path involved.
    pub fn io(path: impl Into<String>, error: &std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            message: error.to_string(),
        }
    }
}
