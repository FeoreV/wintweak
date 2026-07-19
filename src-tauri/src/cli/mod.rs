//! CLI ownership: argument parsing and the genuine headless execution path.

mod args;
mod headless;

pub use args::{Arguments, HeadlessMode, Mode};
pub use headless::run_headless;
