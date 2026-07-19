use std::{fs, path::Path};

#[test]
fn process_and_unsafe_boundaries_remain_narrow() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    assert_boundary(&source, "Command::new", "core\\runner\\allowlist.rs");
    assert_boundary(&source, "unsafe {", "winapi_safe\\mod.rs");
}

fn assert_boundary(root: &Path, needle: &str, allowed_suffix: &str) {
    let mut stack = vec![root.to_owned()];
    while let Some(path) = stack.pop() {
        for entry in fs::read_dir(path).expect("source tree should be readable") {
            let path = entry.expect("source entry should be readable").path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path.extension().is_some_and(|extension| extension == "rs") {
                let normalized = path.to_string_lossy().replace('/', "\\");
                let contents = fs::read_to_string(&path).expect("Rust source should be readable");
                assert!(
                    !contents.contains(needle) || normalized.ends_with(allowed_suffix),
                    "{needle} is only allowed in {allowed_suffix}: {normalized}",
                );
            }
        }
    }
}
