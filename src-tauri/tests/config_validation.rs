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
