//! What the session logic sees of a connection, whatever carries it: a stream of JSON text messages
//! in, a stream out. Transports (WebSocket, WebRTC data channel) are adapters that pump a real
//! connection into a `Link`; dropping the outgoing side tells the adapter to close gracefully.
use std::sync::Arc;

use tokio::sync::{mpsc, Notify};

/// Outgoing half. `wake` lets a transport that owns its own event loop (WebRTC) notice new output.
#[derive(Clone)]
pub struct LinkTx {
    tx: mpsc::Sender<String>,
    wake: Option<Arc<Notify>>,
}

impl LinkTx {
    /// False when the transport is gone.
    pub async fn send(&self, text: String) -> bool {
        if self.tx.send(text).await.is_err() {
            return false;
        }
        if let Some(wake) = &self.wake {
            wake.notify_one();
        }
        true
    }
}

pub struct Link {
    pub rx: mpsc::Receiver<String>,
    pub tx: LinkTx,
    /// The real client address when the transport knows it, for the audit log.
    pub peer_ip: Option<String>,
}

/// The transport's side of a `Link`.
pub struct LinkEnd {
    pub to_session: mpsc::Sender<String>,
    pub from_session: mpsc::Receiver<String>,
}

pub fn pair(peer_ip: Option<String>, wake: Option<Arc<Notify>>) -> (Link, LinkEnd) {
    let (in_tx, in_rx) = mpsc::channel(32);
    let (out_tx, out_rx) = mpsc::channel(64);
    (
        Link {
            rx: in_rx,
            tx: LinkTx { tx: out_tx, wake },
            peer_ip,
        },
        LinkEnd {
            to_session: in_tx,
            from_session: out_rx,
        },
    )
}
