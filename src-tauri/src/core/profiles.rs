//! Built-in profiles compile to the same exact batch used by manual selection.
#![allow(clippy::missing_errors_doc)]

use std::collections::HashSet;

use crate::{
    errors::AppError,
    types::{
        LocalizedText, ProfileDefinition, ProfileDocument, ProfileName, ProfileTweak,
        TweakBatchConfig, TweakDefinition, TweakRequest,
    },
};

use crate::types::TweakDesiredState::{Disabled, Enabled};

pub fn built_in_profiles() -> Vec<ProfileDefinition> {
    use ProfileName::{Balanced, Developer, Minimal, Performance, Privacy};
    vec![
        profile(
            Privacy,
            ("Privacy", "Конфиденциальность"),
            (
                "Reduce documented Windows personalization and activity collection.",
                "Сокращает документированную персонализацию Windows и сбор данных об активности.",
            ),
            &[
                ("disable_advertising_id", Enabled),
                ("disable_activity_history", Enabled),
                ("reduce_diagnostic_data", Enabled),
                ("disable_bing_search_suggestions", Enabled),
                ("disable_widgets", Enabled),
            ],
        ),
        profile(
            Balanced,
            ("Balanced", "Сбалансированный"),
            (
                "Conservative privacy and Explorer usability defaults.",
                "Осторожные настройки конфиденциальности и удобства Проводника.",
            ),
            &[
                ("disable_advertising_id", Enabled),
                ("disable_bing_search_suggestions", Enabled),
                ("show_file_extensions", Enabled),
                ("show_hidden_files", Disabled),
                ("dark_mode", Enabled),
            ],
        ),
        profile(
            Performance,
            ("Performance", "Быстродействие"),
            (
                "Interaction-focused defaults without unverified performance claims.",
                "Настройки взаимодействия без недоказанных обещаний прироста производительности.",
            ),
            &[
                ("disable_widgets", Enabled),
                ("disable_mouse_acceleration", Enabled),
                ("show_file_extensions", Enabled),
            ],
        ),
        profile(
            Developer,
            ("Developer", "Разработчик"),
            (
                "Developer-friendly Explorer and shell defaults.",
                "Удобные для разработки настройки Проводника и оболочки.",
            ),
            &[
                ("show_file_extensions", Enabled),
                ("show_hidden_files", Enabled),
                ("dark_mode", Enabled),
                ("disable_bing_search_suggestions", Disabled),
            ],
        ),
        profile(
            Minimal,
            ("Minimal", "Минимальный"),
            (
                "Small, low-risk set with minimal policy impact.",
                "Небольшой набор с низким риском и минимальным влиянием на политики.",
            ),
            &[
                ("show_file_extensions", Enabled),
                ("show_hidden_files", Disabled),
            ],
        ),
    ]
}

fn profile(
    name: ProfileName,
    title: (&str, &str),
    description: (&str, &str),
    tweaks: &[(&str, crate::types::TweakDesiredState)],
) -> ProfileDefinition {
    ProfileDefinition {
        name,
        title: localized(title),
        description: localized(description),
        tweaks: tweaks
            .iter()
            .map(|(id, desired_state)| ProfileTweak {
                id: (*id).to_owned(),
                desired_state: *desired_state,
            })
            .collect(),
    }
}

fn localized((en, ru): (&str, &str)) -> LocalizedText {
    LocalizedText {
        en: en.to_owned(),
        ru: ru.to_owned(),
    }
}

pub fn plan(name: ProfileName, catalog: &[TweakDefinition]) -> Result<TweakBatchConfig, AppError> {
    let definition = built_in_profiles()
        .into_iter()
        .find(|profile| profile.name == name)
        .ok_or_else(|| AppError::InvalidConfigSchema {
            message: "unknown built-in profile".to_owned(),
        })?;
    document_to_batch(
        &ProfileDocument {
            schema_version: 1,
            name: definition.title.en,
            tweaks: definition.tweaks,
        },
        catalog,
    )
}

pub fn document_to_batch(
    document: &ProfileDocument,
    catalog: &[TweakDefinition],
) -> Result<TweakBatchConfig, AppError> {
    if document.schema_version != 1 {
        return Err(AppError::InvalidConfigSchema {
            message: format!(
                "unsupported profile schema_version {}",
                document.schema_version
            ),
        });
    }
    if document.name.trim().is_empty() || document.name.len() > 80 {
        return Err(AppError::InvalidConfigSchema {
            message: "profile name must contain 1 to 80 characters".to_owned(),
        });
    }
    if document.tweaks.is_empty() {
        return Err(AppError::InvalidConfigSchema {
            message: "profile must contain at least one tweak".to_owned(),
        });
    }
    let known = catalog
        .iter()
        .map(|tweak| tweak.id.as_str())
        .collect::<HashSet<_>>();
    let mut requested = HashSet::new();
    for tweak in &document.tweaks {
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
    Ok(TweakBatchConfig {
        schema_version: 1,
        tweaks: document
            .tweaks
            .iter()
            .map(|tweak| TweakRequest {
                id: tweak.id.clone(),
                desired_state: tweak.desired_state,
            })
            .collect(),
    })
}

pub fn export_document(name: ProfileName) -> Result<ProfileDocument, AppError> {
    let profile = built_in_profiles()
        .into_iter()
        .find(|profile| profile.name == name)
        .ok_or_else(|| AppError::InvalidConfigSchema {
            message: "unknown built-in profile".to_owned(),
        })?;
    Ok(ProfileDocument {
        schema_version: 1,
        name: profile.title.en,
        tweaks: profile.tweaks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::registry_data;

    #[test]
    fn every_built_in_profile_compiles_with_explicit_states() {
        let catalog = registry_data::built_in_catalog().expect("catalog");
        for profile in built_in_profiles() {
            assert!(!profile.tweaks.is_empty());
            let batch = plan(profile.name, &catalog).expect("profile plan");
            assert_eq!(batch.tweaks.len(), profile.tweaks.len());
        }
    }

    #[test]
    fn imported_profiles_reject_duplicate_ids() {
        let catalog = registry_data::built_in_catalog().expect("catalog");
        let duplicate = ProfileDocument {
            schema_version: 1,
            name: "duplicate".to_owned(),
            tweaks: vec![
                ProfileTweak {
                    id: catalog[0].id.clone(),
                    desired_state: Enabled,
                },
                ProfileTweak {
                    id: catalog[0].id.clone(),
                    desired_state: Disabled,
                },
            ],
        };
        assert!(document_to_batch(&duplicate, &catalog).is_err());
    }

    #[test]
    fn exported_profile_round_trips_through_the_strict_typed_format() {
        let exported = export_document(ProfileName::Developer).expect("export profile");
        let json = serde_json::to_string(&exported).expect("serialize profile");
        let imported: ProfileDocument = serde_json::from_str(&json).expect("deserialize profile");
        assert_eq!(imported.tweaks, exported.tweaks);

        let executable_field = r#"{"schema_version":1,"name":"bad","tweaks":[],"script":"whoami"}"#;
        assert!(serde_json::from_str::<ProfileDocument>(executable_field).is_err());
    }
}
