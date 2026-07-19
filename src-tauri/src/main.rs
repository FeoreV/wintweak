//! Process entry point. It chooses headless or GUI mode before Tauri is built.

#![deny(unsafe_op_in_unsafe_fn)]

use std::process::ExitCode;

use native_windows_optimizer::{cli, logging};

fn main() -> ExitCode {
    let arguments = cli::Arguments::parse_process();
    if let Err(error) = logging::initialize(arguments.log_format) {
        eprintln!("failed to initialize logging: {error}");
        return ExitCode::FAILURE;
    }

    match arguments.mode() {
        cli::Mode::Headless(mode) => cli::run_headless(mode),
        cli::Mode::Gui => match native_windows_optimizer::run_gui() {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                tracing::error!(error = %error, outcome = "failed", "GUI terminated");
                ExitCode::FAILURE
            }
        },
    }
}
