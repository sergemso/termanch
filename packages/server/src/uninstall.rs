//! Stage 1 of the remote uninstall (decision 0072): the server wipes its own configuration. A marker file
//! stays behind so a container that Docker restarts does not come back as a fresh unclaimed server; it
//! idles until the marker is removed (the installer's `--claim` does that) or the container is deleted.

use std::path::Path;

use anyhow::Result;

use crate::auth::write_private;

pub const MARKER: &str = "uninstalled";
/// The owner must have signed in this recently (guardrail remote-uninstall-is-deliberate-and-scoped).
pub const FRESH_SECS: u64 = 3600;

/// Checks the typed name and the age of the certificate; the owner check happened at login.
pub fn authorize(
    server_name: &str,
    confirm_name: &str,
    issued_at: Option<u64>,
    now: u64,
) -> Result<(), &'static str> {
    if server_name.is_empty() || confirm_name != server_name {
        return Err("The typed name does not match this server");
    }
    match issued_at {
        Some(t) if t <= now + 60 && now.saturating_sub(t) <= FRESH_SECS => Ok(()),
        _ => Err("Sign in again to uninstall"),
    }
}

/// Removes everything in the config directory except the marker, which is (re)written.
pub fn wipe(dir: &Path) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if path.file_name().is_some_and(|n| n == MARKER) {
            continue;
        }
        if path.is_dir() {
            std::fs::remove_dir_all(&path)?;
        } else {
            std::fs::remove_file(&path)?;
        }
    }
    write_private(&dir.join(MARKER), b"uninstalled\n")
}

pub fn is_uninstalled(dir: &Path) -> bool {
    dir.join(MARKER).exists()
}

pub fn clear(dir: &Path) {
    let _ = std::fs::remove_file(dir.join(MARKER));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_name_and_a_recent_sign_in_are_both_required() {
        let now = 1_000_000;
        assert_eq!(authorize("vps", "vps", Some(now - 60), now), Ok(()));
        assert!(authorize("vps", "other", Some(now), now)
            .unwrap_err()
            .contains("name"));
        assert!(
            authorize("", "", Some(now), now).is_err(),
            "an unnamed server cannot be confirmed"
        );
        let stale = authorize("vps", "vps", Some(now - FRESH_SECS - 1), now);
        assert_eq!(stale, Err("Sign in again to uninstall"));
        assert_eq!(
            authorize("vps", "vps", None, now),
            Err("Sign in again to uninstall")
        );
        assert!(
            authorize("vps", "vps", Some(now + 3600), now).is_err(),
            "issue times in the future are not trusted"
        );
    }

    #[test]
    fn wipe_removes_everything_but_leaves_the_marker() {
        let dir = std::env::temp_dir().join(format!("termanch-uninstall-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("server_key"), b"k").unwrap();
        std::fs::write(dir.join("sub/x"), b"x").unwrap();
        wipe(&dir).unwrap();
        let left: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(left, vec![std::ffi::OsString::from(MARKER)]);
        assert!(is_uninstalled(&dir));
        clear(&dir);
        assert!(!is_uninstalled(&dir));
    }
}
