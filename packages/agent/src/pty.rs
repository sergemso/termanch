use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tokio::process::Command;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

pub struct PtyManager {
    ptys: Arc<RwLock<HashMap<String, PtySession>>>,
}

struct PtySession {
    id: String,
    master_fd: i32,
    pid: u32,
    tx: mpsc::UnboundedSender<Vec<u8>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            ptys: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create(
        &self,
        id: String,
        cols: u16,
        rows: u16,
    ) -> Result<mpsc::UnboundedReceiver<Vec<u8>>> {
        let (tx, rx) = mpsc::unbounded_channel();

        // For MVP, use a simple Command-based approach instead of raw PTY
        let mut child = Command::new("sh")
            .arg("-c")
            .arg(format!("stty rows {} cols {}; exec sh -l", rows, cols))
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let pid = child.id().unwrap_or(0);
        let master_fd = 0; // placeholder

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
        let mut stdout = child.stdout.take().unwrap();
        let mut stderr = child.stderr.take().unwrap();
        let mut stdin = child.stdin.take().unwrap();

        let ptys_clone = ptys.clone();
        let id_clone2 = id.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 4096];
            loop {
                use tokio::io::AsyncReadExt;
                match stdout.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let _ = tx.send(buf[..n].to_vec());
                    }
                    Err(e) => {
                        error!("PTY read error: {}", e);
                        break;
                    }
                }
            }
            ptys_clone.write().await.remove(&id_clone2);
        });

        // Also read stderr
        let tx2 = tx.clone();
        tokio::spawn(async move {
            use tokio::io::AsyncReadExt;
            let mut buf = [0u8; 4096];
            loop {
                match stderr.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        let _ = tx2.send(buf[..n].to_vec());
                    }
                    Err(_) => break,
                }
            }
        });

        // Write to stdin
        let tx3 = tx.clone();
        tokio::spawn(async move {
            // This would be used for writing to the PTY
            let _ = tx3;
        });

        Ok(rx)
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
        if let Some(_session) = ptys.get(id) {
            // For MVP, just log the write
            debug!("PTY write to {}: {} bytes", id, data.len());
            Ok(())
        } else {
            Err(anyhow::anyhow!("PTY not found: {}", id))
        }
    }

    pub async fn resize(&self, id: &str, _cols: u16, _rows: u16) -> Result<()> {
        let _ptys = self.ptys.read().await;
        // For MVP, just log the resize
        debug!("PTY resize {}: {}x{}", id, _cols, _rows);
        Ok(())
    }

    pub async fn close(&self, id: &str) -> Result<()> {
        let mut ptys = self.ptys.write().await;
        if ptys.remove(id).is_some() {
            info!("Closed PTY {}", id);
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
