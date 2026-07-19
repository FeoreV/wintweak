//! Clap definitions kept separate from headless business orchestration.

use std::path::PathBuf;

use clap::Parser;
use uuid::Uuid;

use crate::logging::LogFormat;

#[derive(Debug, Parser)]
#[command(name = "optimizer", version, about = "Native Windows Optimizer")]
#[allow(clippy::struct_excessive_bools)]
pub struct Arguments {
    /// Apply a validated tweak batch without initializing `WebView2`.
    #[arg(
        long,
        value_name = "FILE",
        conflicts_with_all = ["restore", "list_tweaks", "status", "list_recovery"]
    )]
    pub config: Option<PathBuf>,

    /// Plan and read current values without modifying Windows.
    #[arg(long, requires = "config")]
    pub dry_run: bool,

    /// Restore a prior recovery session in reverse order.
    #[arg(long, value_name = "SESSION_ID")]
    pub restore: Option<Uuid>,

    /// Print the built-in tweak catalog and exit.
    #[arg(long, conflicts_with_all = ["status", "list_recovery", "restore"])]
    pub list_tweaks: bool,

    /// Read and print the effective state of every built-in tweak.
    #[arg(long, conflicts_with_all = ["list_recovery", "restore"])]
    pub status: bool,

    /// List available recovery sessions, newest first.
    #[arg(long, conflicts_with = "restore")]
    pub list_recovery: bool,

    /// Select human-readable or JSON structured logs.
    #[arg(long, value_enum, default_value = "human")]
    pub log_format: LogFormat,
}

#[derive(Debug)]
pub enum Mode {
    Gui,
    Headless(HeadlessMode),
}

#[derive(Debug)]
pub enum HeadlessMode {
    Apply { config: PathBuf, dry_run: bool },
    Restore(Uuid),
    ListTweaks,
    Status,
    ListRecovery,
}

impl Arguments {
    pub fn parse_process() -> Self {
        Self::parse()
    }

    pub fn mode(&self) -> Mode {
        if let Some(config) = &self.config {
            return Mode::Headless(HeadlessMode::Apply {
                config: config.clone(),
                dry_run: self.dry_run,
            });
        }
        if let Some(session_id) = self.restore {
            return Mode::Headless(HeadlessMode::Restore(session_id));
        }
        if self.list_tweaks {
            return Mode::Headless(HeadlessMode::ListTweaks);
        }
        if self.status {
            return Mode::Headless(HeadlessMode::Status);
        }
        if self.list_recovery {
            return Mode::Headless(HeadlessMode::ListRecovery);
        }
        Mode::Gui
    }
}
