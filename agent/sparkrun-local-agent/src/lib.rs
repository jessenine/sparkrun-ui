//! SparkRun Local Agent Library
//! 
//! Safe process collection functions that can be used by the main agent or tests.

use serde::{Deserialize, Serialize};

/// Process entry as reported by the system
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ProcessEntry {
    pub user: String,
    pub pid: u32,
    pub cpu: f32,
    pub mem: f32,
    pub command: String,
}

/// Collection result containing process list
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProcessList {
    pub timestamp: u64,
    pub processes: Vec<ProcessEntry>,
    pub agent_id: String,
    pub hostname: String,
}

/// Error types for process collection
#[derive(thiserror::Error, Debug)]
pub enum CollectError {
    #[error("Failed to read process data: {0}")]
    ReadProcessData(String),
    #[error("Failed to parse process info: {0}")]
    ParseProcessInfo(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

/// Collect processes safely using system APIs
/// This function uses only safe Rust and doesn't execute shell commands
pub async fn collect_processes_safe(max_count: usize) -> Result<ProcessList, CollectError> {
    // Use the sysinfo crate which provides safe wrappers
    // For now, this is a placeholder for the actual implementation
    // The main implementation will be in src/main.rs
    Ok(ProcessList {
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        processes: Vec::new(),
        agent_id: "test-agent".to_string(),
        hostname: "localhost".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_collect_processes() {
        let result = collect_processes_safe(5).await;
        assert!(result.is_ok());
        
        let processes = result.unwrap();
        assert!(processes.processes.len() <= 5);
    }
}
