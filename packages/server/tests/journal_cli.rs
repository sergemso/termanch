//! The installer talks to the journal through the binary's command line; this drives that interface for real.

use std::path::PathBuf;
use std::process::{Command, Output};

fn temp() -> PathBuf {
    let d = std::env::temp_dir().join(format!("termanch-journal-cli-{}", uuid_like()));
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn uuid_like() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}

fn server(journal: &std::path::Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_termanch-server"))
        .args(["--journal-dir", journal.to_str().unwrap()])
        .args(args)
        .output()
        .unwrap()
}

fn text(o: &Output) -> String {
    String::from_utf8_lossy(&o.stdout).into_owned()
}

#[test]
fn install_then_revert_restores_the_starting_state() {
    let dir = temp();
    let journal = dir.join("journal");
    let file = dir.join("termanch-server");
    let unit_free = dir.join("conf");

    // Record before applying, as the installer does, then apply.
    std::fs::write(&file, "binary").unwrap();
    let out = server(
        &journal,
        &[
            "--journal-record",
            "file_created",
            "--journal-field",
            &format!("path={}", file.display()),
        ],
    );
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    std::fs::write(&unit_free, "old").unwrap();
    std::fs::rename(&unit_free, dir.join("conf.orig")).unwrap();
    std::fs::write(&unit_free, "new").unwrap();
    let out = server(
        &journal,
        &[
            "--journal-record",
            "file_replaced",
            "--journal-field",
            &format!("path={}", unit_free.display()),
            "--journal-field",
            &format!("backup={}", dir.join("conf.orig").display()),
        ],
    );
    assert!(out.status.success());

    assert_eq!(
        text(&server(&journal, &["--journal-list"])).lines().count(),
        2
    );

    // A dry run changes nothing.
    let dry = server(&journal, &["--revert", "--dry-run"]);
    assert!(
        text(&dry).contains("would revert: [2, 1]"),
        "{}",
        text(&dry)
    );
    assert!(file.exists());

    // The real revert restores the start; a second one has nothing left to do.
    let real = server(&journal, &["--revert"]);
    assert!(real.status.success(), "{}", text(&real));
    assert!(!file.exists());
    assert_eq!(std::fs::read_to_string(&unit_free).unwrap(), "old");
    assert!(text(&server(&journal, &["--revert"])).contains("reverted: []"));
    assert_eq!(text(&server(&journal, &["--journal-list"])), "");
}

#[test]
fn an_edited_file_is_reported_and_kept() {
    let dir = temp();
    let journal = dir.join("journal");
    let file = dir.join("settings");
    std::fs::write(&file, "ours").unwrap();
    server(
        &journal,
        &[
            "--journal-record",
            "file_created",
            "--journal-field",
            &format!("path={}", file.display()),
        ],
    );
    std::fs::write(&file, "the owner's edit").unwrap();
    let out = server(&journal, &["--revert"]);
    assert!(text(&out).contains("modified"), "{}", text(&out));
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "the owner's edit");
}

#[test]
fn unknown_kinds_and_missing_fields_are_refused() {
    let dir = temp();
    let journal = dir.join("journal");
    assert!(!server(&journal, &["--journal-record", "rm_rf"])
        .status
        .success());
    assert!(!server(&journal, &["--journal-record", "user_created"])
        .status
        .success());
}
