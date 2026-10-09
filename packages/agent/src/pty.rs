use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use nix::pty::{forkpty, Winsize};
use nix::unistd::{close, write, ForkResult};
use tokio::sync::{mpsc, RwLock};
use tokio::process::Command;
use tracing::{debug, error, info, warn};

pub struct PtyManager {
    ptys: Arc<RwLock<HashMap<String, PtySession>>>,
}

struct PtySession {
    id: String,
    master_fd: std::os::fd::RawFd,
    pid: nix::unistd::Pid,
    tx: mpsc::UnboundedSender<Vec<u8>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            ptys: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create(&self, id: String, cols: u16, rows: u16) -> Result<mpsc::UnboundedReceiver<Vec<u8>>> {
        let (tx, rx) = mpsc::unbounded_channel();

        let ws = Winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };

        match unsafe { forkpty(Some(&ws), None) }? {
            ForkResult::Parent { child, master_fd } => {
                let pid = child;
                info!("Created PTY {} with pid {}", id, pid);

                let session = PtySession {
                    id: id.clone(),
                    master_fd,
                    pid,
                    tx: tx.clone(),
                };

                self.ptys.write().await.insert(id.clone(), session);

                let ptys = self.ptys.clone();
                let id_clone = id.clone();
                tokio::spawn(async move {
                    let mut buf = [0u8; 4096];
                    loop {
                        match tokio::task::spawn_blocking({
                            let fd = master_fd;
                            move || {
                                use std::os::fd::AsRawFd;
                                let mut f = unsafe { std::fs::File::from_raw_fd(fd) };
                                use std::io::Read;
                                f.read(&mut buf)
                            }
                        }).await {
                            Ok(Ok(n)) if n > 0 => {
                                let _ = tx.send(buf[..n].to_vec());
                            }
                            Ok(Ok(_)) => break,
                            Ok(Err(e)) => {
                                error!("PTY read error: {}", e);
                                break;
                            }
                            Err(e) => {
                                error!("PTY task error: {}", e);
                                break;
                            }
                        }
                    }
                    ptys.write().await.remove(&id_clone);
                    let _ = close(master_fd);
                });

                Ok(rx)
            }
            ForkResult::Child => {
                let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
                let _ = Command::new(&shell).arg("-l").status().await;
                std::process::exit(0);
            }
        }
    }

    pub async fn attach(&self, id: &str) -> Result<mpsc::UnboundedReceiver<Vec<u8>>> {
        let mut ptys = self.ptys.write().await;
        if let Some(session) = ptys.get_mut(id) {
            let (tx, rx) = mpsc::unbounded_channel();
            session.tx = tx;
            Ok(rx)
        } else {
            Err(anyhow::anyhow!("PTY not found: {}", id))
        }
    }

    pub async fn write(&self, id: &str, data: &[u8]) -> Result<()> {
        let ptys = self.ptys.read().await;
        if let Some(session) = ptys.get(id) {
            let _ = write(session.master_fd, data)?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("PTY not found: {}", id))
        }
    }

    pub async fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        let ptys = self.ptys.read().await;
        if let Some(session) = ptys.get(id) {
            let ws = Winsize {
                ws_row: rows,
                ws_col: cols,
                ws_xpixel: 0,
                ws_ypixel: 0,
            };
            unsafe {
                nix::ioctl_write_ptr!(TIOCSWINSZ, Winsize);
                let _ = nix::ioctl(session.master_fd, nix::libc::TIOCSWINSZ, &ws);
            }
            Ok(())
        } else {
            Err(anyhow::anyhow!("PTY not found: {}", id))
        }
    }

    pub async fn close(&self, id: &str) -> Result<()> {
        let mut ptys = self.ptys.write().await;
        if let Some(session) = ptys.remove(id) {
            let _ = nix::sys::signal::kill(session.pid, nix::sys::signal::Signal::SIGTERM);
            let _ = close(session.master_fd);
            Ok(())
        } else {
            Err(anyhow::anyhow!("PTY not found: {}", id))
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}