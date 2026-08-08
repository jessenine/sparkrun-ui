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

/// Compute a process CPU usage percentage from the delta in consumed CPU
/// ticks between two consecutive samples, relative to the real time elapsed
/// in between. `clk_ticks_per_sec` is the kernel clock-tick rate (typically
/// 100 on Linux). Returns 0.0 when there is no elapsed time or the counter
/// went backwards (process replaced).
pub fn compute_cpu_percent(
    prev_ticks: u64,
    curr_ticks: u64,
    elapsed_secs: f32,
    clk_ticks_per_sec: f32,
) -> f32 {
    if elapsed_secs <= 0.0 || clk_ticks_per_sec <= 0.0 {
        return 0.0;
    }
    let total_ticks = elapsed_secs * clk_ticks_per_sec;
    if total_ticks <= 0.0 {
        return 0.0;
    }
    let delta = curr_ticks.saturating_sub(prev_ticks) as f32;
    ((delta / total_ticks) * 100.0).max(0.0)
}

/// Compute a process memory usage percentage given its resident set size in
/// bytes and the total system memory in bytes. Returns 0.0 when total is
/// unknown (avoids division by zero).
pub fn compute_mem_percent(rss_bytes: u64, total_bytes: u64) -> f32 {
    if total_bytes == 0 {
        return 0.0;
    }
    ((rss_bytes as f32 / total_bytes as f32) * 100.0).max(0.0)
}

/// Determine the local IP address of the machine this agent runs on.
/// Uses the dependency-free UDP-connect trick: binding to an ephemeral local
/// port and connecting to a fixed remote address (connection never transmits)
/// selects the egress interface, whose local address we read back. Degrades to
/// the "unknown" sentinel when no address can be resolved, so callers never
/// get an empty string and never panic.
pub fn get_local_ip() -> String {
    use std::net::UdpSocket;
    match UdpSocket::bind("0.0.0.0:0") {
        Ok(sock) => {
            if sock.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = sock.local_addr() {
                    return addr.ip().to_string();
                }
            }
            "unknown".to_string()
        }
        Err(_) => "unknown".to_string(),
    }
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

    #[test]
    fn cpu_percent_from_tick_delta() {
        // 50 ticks consumed over 1s at 100 ticks/sec = 50%
        assert!((compute_cpu_percent(100, 150, 1.0, 100.0) - 50.0).abs() < 0.001);
        // 200 ticks over 1s at 100 ticks/sec = 200% (multi-threaded process scope)
        assert!((compute_cpu_percent(100, 300, 1.0, 100.0) - 200.0).abs() < 0.001);
        // No elapsed time -> 0 (guard div-by-zero)
        assert_eq!(compute_cpu_percent(0, 10, 0.0, 100.0), 0.0);
        // Counter went backwards (PID reused) -> clamp to 0
        assert_eq!(compute_cpu_percent(200, 100, 1.0, 100.0), 0.0);
    }

    #[test]
    fn mem_percent_of_total() {
        // 1 GiB of 16 GiB = 6.25%
        let rss = 1024u64 * 1024 * 1024;
        let total = 16u64 * 1024 * 1024 * 1024;
        assert!((compute_mem_percent(rss, total) - 6.25).abs() < 0.001);
        // Zero total -> 0 (no div-by-zero)
        assert_eq!(compute_mem_percent(1000, 0), 0.0);
        // Clamped to 0 for empty rss
        assert_eq!(compute_mem_percent(0, total), 0.0);
    }

    #[test]
    fn local_ip_returns_a_value() {
        // The machine always has a hostname/IP to report; if enumeration fails it
        // must degrade to a known sentinel rather than panic or return empty.
        let ip = get_local_ip();
        assert!(!ip.is_empty(), "get_local_ip must return an IP or the 'unknown' sentinel");
    }
}
