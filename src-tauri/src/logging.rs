//! Configures one structured tracing pipeline for both CLI and GUI modes.

use std::sync::OnceLock;

use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use specta::Type;
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

use crate::errors::AppError;

static INITIALIZED: OnceLock<()> = OnceLock::new();

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, Type, ValueEnum)]
#[serde(rename_all = "snake_case")]
pub enum LogFormat {
    #[default]
    Human,
    Json,
}

/// Installs the global tracing subscriber once.
///
/// # Errors
/// Returns an error if another subscriber was installed first.
pub fn initialize(format: LogFormat) -> Result<(), AppError> {
    if INITIALIZED.get().is_some() {
        return Ok(());
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let result = match format {
        LogFormat::Human => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().with_target(true).with_writer(std::io::stdout))
            .try_init(),
        LogFormat::Json => tracing_subscriber::registry()
            .with(filter)
            .with(
                fmt::layer()
                    .json()
                    .with_target(true)
                    .with_writer(std::io::stdout),
            )
            .try_init(),
    };

    result.map_err(|error| AppError::InvalidConfigSchema {
        message: format!("logging subscriber: {error}"),
    })?;
    let _ = INITIALIZED.set(());
    Ok(())
}
