//! Loads the built-in declarative tweak catalog embedded at compile time.

use crate::{errors::AppError, types::TweakDefinition};

const BUILT_IN_TWEAKS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/data/tweaks/catalog.json"
));

/// Deserializes the built-in tweak catalog using strict DTOs.
///
/// # Errors
/// Returns [`AppError::InvalidConfigSchema`] when shipped data is malformed.
pub fn built_in_catalog() -> Result<Vec<TweakDefinition>, AppError> {
    serde_json::from_str(BUILT_IN_TWEAKS).map_err(|error| AppError::InvalidConfigSchema {
        message: format!("built-in tweak catalog: {error}"),
    })
}
