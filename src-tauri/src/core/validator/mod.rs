//! Performs the all-or-nothing planning validation before any mutation.

use std::collections::HashSet;

use crate::{
    errors::AppError,
    types::{TweakBatchConfig, TweakDefinition, ValidationReport},
};

/// Validates a complete batch before execution begins.
///
/// # Errors
/// Returns a schema or unknown-tweak error without mutating system state.
pub fn validate_batch(
    config: &TweakBatchConfig,
    catalog: &[TweakDefinition],
) -> Result<ValidationReport, AppError> {
    if config.schema_version != 1 {
        return Err(AppError::InvalidConfigSchema {
            message: format!("unsupported schema_version {}", config.schema_version),
        });
    }
    if config.tweaks.is_empty() {
        return Err(AppError::InvalidConfigSchema {
            message: "tweaks must contain at least one item".to_owned(),
        });
    }

    let known: HashSet<&str> = catalog.iter().map(|item| item.id.as_str()).collect();
    let mut requested = HashSet::new();
    for tweak in &config.tweaks {
        if !known.contains(tweak.id.as_str()) {
            return Err(AppError::UnknownTweak {
                tweak_id: tweak.id.clone(),
            });
        }
        if !requested.insert(tweak.id.as_str()) {
            return Err(AppError::InvalidConfigSchema {
                message: format!("duplicate tweak id '{}'", tweak.id),
            });
        }
    }

    let tweak_count =
        u32::try_from(config.tweaks.len()).map_err(|_| AppError::InvalidConfigSchema {
            message: "tweak count exceeds supported range".to_owned(),
        })?;
    Ok(ValidationReport {
        valid: true,
        tweak_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TweakRequest;

    #[test]
    fn rejects_unknown_tweak_before_execution() {
        let config = TweakBatchConfig {
            schema_version: 1,
            tweaks: vec![TweakRequest {
                id: "missing".to_owned(),
            }],
        };

        assert!(matches!(
            validate_batch(&config, &[]),
            Err(AppError::UnknownTweak { .. })
        ));
    }
}
