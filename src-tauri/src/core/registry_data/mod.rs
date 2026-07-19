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
    let catalog: Vec<TweakDefinition> =
        serde_json::from_str(BUILT_IN_TWEAKS).map_err(|error| AppError::InvalidConfigSchema {
            message: format!("built-in tweak catalog: {error}"),
        })?;
    validate_catalog(&catalog)?;
    Ok(catalog)
}

fn validate_catalog(catalog: &[TweakDefinition]) -> Result<(), AppError> {
    if catalog.len() < 10 {
        return Err(AppError::InvalidConfigSchema {
            message: format!(
                "built-in tweak catalog must contain at least 10 entries; found {}",
                catalog.len()
            ),
        });
    }
    let mut ids = std::collections::HashSet::new();
    for definition in catalog {
        if definition.id.trim().is_empty() || !ids.insert(definition.id.as_str()) {
            return Err(AppError::InvalidConfigSchema {
                message: format!("invalid or duplicate tweak id '{}'", definition.id),
            });
        }
        if definition.title.en.trim().is_empty()
            || definition.title.ru.trim().is_empty()
            || definition.description.en.trim().is_empty()
            || definition.description.ru.trim().is_empty()
            || definition.support.notes.en.trim().is_empty()
            || definition.support.notes.ru.trim().is_empty()
        {
            return Err(AppError::InvalidConfigSchema {
                message: format!("tweak '{}' is missing localized metadata", definition.id),
            });
        }
        if definition.detect.is_empty()
            || definition.apply.is_empty()
            || definition.restore.is_empty()
            || definition.detect.len() != definition.apply.len()
            || definition.references.is_empty()
            || definition.affected_paths.is_empty()
            || definition.architectures.is_empty()
            || definition.support.versions.is_empty()
        {
            return Err(AppError::InvalidConfigSchema {
                message: format!(
                    "tweak '{}' has incomplete operations or support metadata",
                    definition.id
                ),
            });
        }
        if !definition.reversible && definition.irreversible_reason.is_none() {
            return Err(AppError::InvalidConfigSchema {
                message: format!("irreversible tweak '{}' must explain why", definition.id),
            });
        }
        if definition.reversible && definition.irreversible_reason.is_some() {
            return Err(AppError::InvalidConfigSchema {
                message: format!(
                    "reversible tweak '{}' cannot have an irreversible reason",
                    definition.id
                ),
            });
        }
        if definition
            .references
            .iter()
            .any(|reference| !reference.starts_with("https://"))
        {
            return Err(AppError::InvalidConfigSchema {
                message: format!("tweak '{}' contains a non-HTTPS reference", definition.id),
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipped_catalog_has_the_reviewed_ten_tweaks() {
        let catalog = built_in_catalog().expect("catalog");
        assert!(catalog.len() >= 10);
        assert!(!catalog.iter().any(|tweak| tweak.id == "enable_long_paths"));
    }
}
