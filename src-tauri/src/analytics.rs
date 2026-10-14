use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::fs::{self, OpenOptions};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;
use tracing::{info, warn};

const ANALYTICS_ENDPOINT: &str = "https://anyfile-convert.com/api/analytics";
const FLUSH_INTERVAL_SECS: u64 = 300; // 5 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEvent {
    #[serde(default = "new_event_id")]
    pub event_id: String,
    pub event: String,
    pub category: String,
    pub operation: String,
    pub platform: String,
    pub app_version: String,
    #[serde(default = "one_event")]
    pub quantity: u16,
    pub timestamp: u64,
}

fn one_event() -> u16 {
    1
}

fn new_event_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub struct AnalyticsQueue {
    file_path: PathBuf,
    client_id: String,
    lock: Arc<Mutex<()>>, // Prevent concurrent file access between push and flush
    enabled: AtomicBool,
}

impl AnalyticsQueue {
    pub fn new(app_data_dir: PathBuf, enabled: bool) -> Self {
        let file_path = app_data_dir.join("analytics.jsonl");
        let client_id_path = app_data_dir.join("client_id.txt");

        let client_id = if client_id_path.exists() {
            std::fs::read_to_string(&client_id_path)
                .unwrap_or_else(|_| uuid::Uuid::new_v4().to_string())
        } else {
            let id = uuid::Uuid::new_v4().to_string();
            let _ = std::fs::write(&client_id_path, &id);
            id
        };

        if !enabled && file_path.exists() {
            if let Err(error) = std::fs::remove_file(&file_path) {
                warn!("Failed to clear queued analytics while analytics is disabled: {error}");
            }
        }

        Self {
            file_path,
            client_id,
            lock: Arc::new(Mutex::new(())),
            enabled: AtomicBool::new(enabled),
        }
    }

    pub async fn set_enabled(&self, enabled: bool) -> Result<(), std::io::Error> {
        self.enabled.store(enabled, Ordering::Relaxed);
        if !enabled {
            let _guard = self.lock.lock().await;
            if self.file_path.exists() {
                fs::remove_file(&self.file_path).await?;
            }
        }
        Ok(())
    }

    /// Appends an event to the local file queue
    pub async fn push(&self, event: AnalyticsEvent) -> Result<(), Box<dyn std::error::Error>> {
        if !self.enabled.load(Ordering::Relaxed) {
            return Ok(());
        }
        let _guard = self.lock.lock().await;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)
            .await?;

        let mut line = serde_json::to_string(&event)?;
        line.push('\n');

        file.write_all(line.as_bytes()).await?;
        Ok(())
    }

    /// Reads all queued events, sends them, and clears the queue on success
    pub async fn flush(&self) {
        if !self.enabled.load(Ordering::Relaxed) {
            return;
        }
        let _guard = self.lock.lock().await;

        if !self.file_path.exists() {
            return;
        }

        let file = match fs::File::open(&self.file_path).await {
            Ok(f) => f,
            Err(_) => return, // Can't read, skip
        };

        let mut lines = BufReader::new(file).lines();
        let mut batch = Vec::new();

        while let Ok(Some(line)) = lines.next_line().await {
            if let Ok(event) = serde_json::from_str::<AnalyticsEvent>(&line) {
                batch.push(event);
            }
        }

        if batch.is_empty() {
            return; // Nothing to do
        }

        #[derive(Serialize)]
        struct Payload<'a> {
            client_id: &'a str,
            events: &'a [AnalyticsEvent],
        }

        let payload = Payload {
            client_id: &self.client_id,
            events: &batch,
        };

        let client = reqwest::Client::new();
        match client.post(ANALYTICS_ENDPOINT).json(&payload).send().await {
            Ok(res) if res.status().is_success() => {
                info!("Successfully uploaded {} analytics events", batch.len());
                // Success: clear the file
                if let Err(e) = fs::remove_file(&self.file_path).await {
                    warn!("Failed to clear analytics queue file: {}", e);
                }
            }
            Ok(res) => {
                warn!("Analytics server returned error status: {}", res.status());
            }
            Err(e) => {
                warn!("Failed to send analytics (offline or unreachable): {}", e);
            }
        }
    }

    /// Spawns a background task to flush the queue periodically
    pub fn start_worker(queue: Arc<AnalyticsQueue>) {
        tauri::async_runtime::spawn(async move {
            // Wait a few seconds on startup before first flush
            tokio::time::sleep(Duration::from_secs(5)).await;

            loop {
                queue.flush().await;
                tokio::time::sleep(Duration::from_secs(FLUSH_INTERVAL_SECS)).await;
            }
        });
    }
}
