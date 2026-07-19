use native_windows_optimizer::{core, types::TweakBatchConfig};

#[test]
fn shipped_example_and_catalog_validate_together() {
    let config: TweakBatchConfig = serde_json::from_str(include_str!("../data/example.batch.json"))
        .expect("shipped example must deserialize");
    let catalog = core::registry_data::built_in_catalog().expect("catalog must deserialize");

    let report = core::validator::validate_batch(&config, &catalog).expect("batch must validate");
    assert_eq!(report.tweak_count, 4);
}

#[test]
fn unknown_fields_are_rejected() {
    let malformed = r#"{"schema_version":1,"tweaks":[],"script":"whoami"}"#;
    assert!(serde_json::from_str::<TweakBatchConfig>(malformed).is_err());
}

#[test]
fn catalog_has_complete_reversible_microsoft_documented_definitions() {
    let catalog = core::registry_data::built_in_catalog().expect("catalog must deserialize");
    assert!(catalog.len() >= 10);
    for tweak in catalog {
        assert!(!tweak.detect.is_empty(), "{} detect", tweak.id);
        assert!(!tweak.apply.is_empty(), "{} apply", tweak.id);
        assert!(!tweak.restore.is_empty(), "{} restore", tweak.id);
        assert!(!tweak.affected_paths.is_empty(), "{} paths", tweak.id);
        assert!(
            tweak
                .references
                .iter()
                .all(|url| url.starts_with("https://learn.microsoft.com/")
                    || url.starts_with("https://support.microsoft.com/")),
            "{} must use Microsoft references",
            tweak.id
        );
    }
}

#[test]
fn all_profiles_compile_to_known_exact_batches() {
    let catalog = core::registry_data::built_in_catalog().expect("catalog");
    for profile in core::profiles::built_in_profiles() {
        let batch = core::profiles::plan(profile.name, &catalog).expect("profile batch");
        assert_eq!(batch.tweaks.len(), profile.tweaks.len());
        assert_eq!(
            batch.tweaks.iter().map(|item| &item.id).collect::<Vec<_>>(),
            profile
                .tweaks
                .iter()
                .map(|item| &item.id)
                .collect::<Vec<_>>()
        );
    }
}
