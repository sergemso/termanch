//! The hook command an agent tool runs (`termenbox-server --hook claude`), as a real process:
//! it must hand the event over when the server listens and must neither fail nor delay the caller when not.
use std::io::{Read, Write};
use std::os::unix::net::UnixListener;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

fn hook(socket: &str, stdin: &str, keep_open: bool) -> (std::process::Output, Duration) {
    let t = Instant::now();
    let mut child = Command::new(env!("CARGO_BIN_EXE_termenbox-server"))
        .args(["--hook", "claude"])
        .env("TERMENBOX_SESSION", "work")
        .env("TERMENBOX_EVENT_TOKEN", "tok")
        .env("TERMENBOX_EVENT_SOCKET", socket)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut sin = child.stdin.take().unwrap();
    sin.write_all(stdin.as_bytes()).unwrap();
    if keep_open {
        std::mem::forget(sin); // a stdin that never closes
    } else {
        drop(sin);
    }
    let out = child.wait_with_output().unwrap();
    (out, t.elapsed())
}

#[test]
fn the_event_reaches_a_listening_socket_as_one_line() {
    let dir = std::env::temp_dir().join(format!("tm-hook-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let sock = dir.join("e.sock");
    let listener = UnixListener::bind(&sock).unwrap();
    let reader = std::thread::spawn(move || {
        let (mut s, _) = listener.accept().unwrap();
        let mut line = String::new();
        s.read_to_string(&mut line).unwrap();
        line
    });
    let (out, _) = hook(
        sock.to_str().unwrap(),
        r#"{"hook_event_name":"Stop"}"#,
        false,
    );
    assert!(out.status.success());
    assert!(
        out.stdout.is_empty() && out.stderr.is_empty(),
        "a hook must be silent"
    );
    let line = reader.join().unwrap();
    let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
    assert_eq!(v["session"], "work");
    assert_eq!(v["token"], "tok");
    assert_eq!(v["adapter"], "claude");
    assert_eq!(v["data"]["hook_event_name"], "Stop");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn with_the_server_stopped_the_caller_is_neither_failed_nor_delayed() {
    let (out, took) = hook(
        "/nonexistent/events.sock",
        r#"{"hook_event_name":"Stop"}"#,
        false,
    );
    assert!(out.status.success() && out.stdout.is_empty());
    assert!(took < Duration::from_millis(800), "{took:?}");
}

#[test]
fn a_stdin_that_never_closes_is_given_up_on_within_two_seconds() {
    let (out, took) = hook("/nonexistent/events.sock", "{", true);
    assert!(out.status.success());
    assert!(took < Duration::from_secs(2), "{took:?}");
}
