//! SparkRun Local Agent - Secure process monitoring for cluster nodes
//! 
//! This agent runs on each cluster member node to collect process data securely.
//! It exposes a local HTTP endpoint that the UI can query instead of using SSH.

use clap::Parser;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::SystemTime;
use tracing::{info, error};
use uuid::Uuid;
use sparkrun_local_agent::{compute_cpu_percent, compute_mem_percent, get_local_ip};

// Process CPU sampling state: previous consumed CPU ticks per PID, the kernel
// clock-tick rate (typically 100 Hz on Linux), and the wall-clock instant of the
// previous collection used as the CPU% time denominator.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
const CLK_TCK: f32 = 100.0;
static PREV_CPU_TICKS: OnceLock<Mutex<HashMap<u32, u64>>> = OnceLock::new();
static LAST_COLLECT: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Parser, Debug)]
#[command(name = "sparkrun-local-agent")]
#[command(about = "Secure local process monitoring agent for SparkRun cluster")]
struct Args {
    /// Port to listen on (default: 8081)
    #[arg(short, long, default_value = "8081")]
    port: u16,

    /// Host to bind to (default: 0.0.0.0)
    #[arg(short, long, default_value = "0.0.0.0")]
    host: String,

    /// Interval between process collection (default: 2000ms)
    #[arg(short, long, default_value = "2000")]
    interval_ms: u64,

    /// Maximum number of processes to return
    #[arg(short, long, default_value = "5")]
    max_processes: usize,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProcessEntry {
    user: String,
    pid: u32,
    cpu: f32,
    mem: f32,
    command: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProcessList {
    timestamp: u64,
    processes: Vec<ProcessEntry>,
    agent_id: String,
    hostname: String,
    ip_address: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct HealthResponse {
    status: String,
    timestamp: u64,
    agent_id: String,
    uptime_seconds: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct MetricsResponse {
    timestamp: u64,
    uptime_seconds: u64,
    process_count: usize,
    agent_id: String,
}

/// Collect process data using safe system APIs
/// Uses sysinfo crate which provides safe wrappers around system calls
async fn collect_processes(max_count: usize) -> Result<ProcessList, CollectError> {
    let start_time = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Get hostname and IP safely (identity surfaced for BUG-B)
    let hostname = get_hostname();
    let ip_address = get_local_ip();

    // Wall-clock time since the previous collection. This is the denominator
    // that turns consumed-CPU-tick deltas into a real per-second percentage.
    let elapsed_secs = {
        let mut last = LAST_COLLECT.lock().unwrap();
        let e = last.map(|l| l.elapsed().as_secs_f32()).unwrap_or(0.0);
        *last = Some(Instant::now());
        e
    };
    let total_mem = get_total_memory_bytes();

    let mut processes: Vec<ProcessEntry> = Vec::new();

    // Use a safe approach - read /proc directly (no shell execution)
    #[cfg(target_os = "linux")]
    {
        if let Ok(samples) = read_proc_files() {
            let mut prev = PREV_CPU_TICKS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap();
            for s in samples {
                // First sighting of a PID: no delta available, treat as idle.
                let prev_ticks = prev.get(&s.pid).copied().unwrap_or(s.cpu_ticks);
                let cpu = compute_cpu_percent(prev_ticks, s.cpu_ticks, elapsed_secs, CLK_TCK);
                let mem = compute_mem_percent(s.rss_bytes, total_mem);
                prev.insert(s.pid, s.cpu_ticks);
                processes.push(ProcessEntry {
                    user: s.user,
                    pid: s.pid,
                    cpu,
                    mem,
                    command: s.comm,
                });
            }
        }
    }

    // Sort by CPU usage descending and take top N
    processes.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    let top_processes = processes.into_iter().take(max_count).collect();

    Ok(ProcessList {
        timestamp: start_time,
        processes: top_processes,
        agent_id: Uuid::new_v4().to_string(),
        hostname,
        ip_address,
    })
}

/// A raw snapshot of one process, before CPU/mem percentages are computed.
#[cfg(target_os = "linux")]
struct ProcSample {
    pid: u32,
    user: String,
    comm: String,
    rss_bytes: u64,
    cpu_ticks: u64,
}

/// Read raw process snapshots from the /proc filesystem safely (no shell).
#[cfg(target_os = "linux")]
fn read_proc_files() -> Result<Vec<ProcSample>, CollectError> {
    let mut samples = Vec::new();

    if let Ok(entries) = std::fs::read_dir("/proc") {
        for entry in entries.filter_map(|e| e.ok()) {
            let pid_str = entry.file_name().to_string_lossy().to_string();
            if let Ok(pid) = pid_str.parse::<u32>() {
                if let Some(sample) = read_proc_sample(pid) {
                    samples.push(sample);
                }
            }
        }
    }

    Ok(samples)
}

/// Read a raw snapshot for a single process: CPU ticks (utime+stime) from
/// /proc/[pid]/stat and resident-set size from /proc/[pid]/statm.
#[cfg(target_os = "linux")]
fn read_proc_sample(pid: u32) -> Option<ProcSample> {
    let stat = std::fs::read_to_string(format!("/proc/{}/stat", pid)).ok()?;
    let statm = std::fs::read_to_string(format!("/proc/{}/statm", pid)).ok()?;

    let lparen = stat.find('(')?;
    let rparen = stat.rfind(')')?;
    let comm = &stat[lparen + 1..rparen];
    let after_comm = &stat[rparen + 2..];
    let parts: Vec<&str> = after_comm.split_whitespace().collect();

    // After `pid (comm)`: [state, ppid, pgrp, session, tty, tpgid, flags,
    // minflt, cminflt, majflt, cmajflt, utime, stime, ...]
    if parts.len() < 13 {
        return None;
    }
    let utime: u64 = parts[11].parse().ok()?;
    let stime: u64 = parts[12].parse().ok()?;

    let statm_parts: Vec<&str> = statm.split_whitespace().collect();
    if statm_parts.len() < 2 {
        return None;
    }
    let rss_pages: u64 = statm_parts[1].parse().ok()?;

    let user = get_process_user(pid).unwrap_or_else(|_| "unknown".to_string());
    Some(ProcSample {
        pid,
        user,
        comm: comm.to_string(),
        rss_bytes: rss_pages * 4096,
        cpu_ticks: utime + stime,
    })
}

/// Read total system memory in bytes from /proc/meminfo (safe read).
#[cfg(target_os = "linux")]
fn get_total_memory_bytes() -> u64 {
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if let Some(rest) = line.strip_prefix("MemTotal:") {
                if let Ok(kb) = rest.trim().split_whitespace().next().unwrap_or("").parse::<u64>() {
                    return kb * 1024;
                }
            }
        }
    }
    0
}

/// Get process owner (user) safely
#[cfg(target_os = "linux")]
fn get_process_user(pid: u32) -> Result<String, std::io::Error> {
    use std::fs;
    
    let stat_path = format!("/proc/{}/stat", pid);
    if let Ok(content) = fs::read_to_string(&stat_path) {
        let parts: Vec<&str> = content.split_whitespace().collect();
        if parts.len() >= 1 {
            // UID is field 4 in /proc/[pid]/status
            let status_path = format!("/proc/{}/status", pid);
            if let Ok(status) = fs::read_to_string(&status_path) {
                for line in status.lines() {
                    if line.starts_with("Uid:") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            // Convert UID to username
                            if let Ok(uid) = parts[1].parse::<u32>() {
                                return Ok(get_username_by_uid(uid));
                            }
                        }
                    }
                }
            }
        }
    }
    Ok("unknown".to_string())
}

/// Get username by UID (safe lookup)
#[cfg(target_os = "linux")]
fn get_username_by_uid(uid: u32) -> String {
    // Safe method: read /etc/passwd or use a cached approach
    // For production, this would use nsswitch or a proper library
    if uid == 0 {
        return "root".to_string();
    }
    
    // In a production agent, you'd use libc::getpwuid_r for thread-safe lookup
    // For now, return "uid:NNN" format
    format!("uid:{}", uid)
}

/// Get local hostname safely
fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    
    // Initialize logging
    let log_level = if args.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt()
        .with_env_filter(format!("sparkrun_local_agent={}", log_level))
        .init();
    
    info!("Starting SparkRun Local Agent v{}", env!("CARGO_PKG_VERSION"));
    info!("Listening on {}:{}", args.host, args.port);
    info!("Process collection interval: {}ms", args.interval_ms);
    
    let state = AgentState {
        agent_id: Uuid::new_v4().to_string(),
        start_time: SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        max_processes: args.max_processes,
    };
    
    let app = axum::Router::new()
        .route("/", axum::routing::get(root_handler))
        .route("/health", axum::routing::get(health_handler))
        .route("/metrics", axum::routing::get(metrics_handler))
        .route("/processes", axum::routing::get(processes_handler))
        .with_state(state);
    
    // Bind to socket address
    let addr: SocketAddr = format!("{}:{}", args.host, args.port)
        .parse()
        .expect("Invalid address");
    
    info!("Agent initialized successfully");
    info!("Ready to serve process data");
    
    // Start the server
    // For production, you'd use axum-server with TLS
    // This example uses plain HTTP for local-only communication
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind to address");
    
    axum::serve(listener, app)
        .await
        .expect("Server error");
}

// Request handlers

async fn root_handler() -> &'static str {
    "SparkRun Local Agent - Secure Process Monitoring"
}

async fn health_handler(state: axum::extract::State<AgentState>) -> impl axum::response::IntoResponse {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    let uptime = now.saturating_sub(state.start_time);
    
    axum::Json(HealthResponse {
        status: "healthy".to_string(),
        timestamp: now,
        agent_id: state.agent_id.clone(),
        uptime_seconds: uptime,
    })
}

async fn metrics_handler(state: axum::extract::State<AgentState>) -> impl axum::response::IntoResponse {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    let uptime = now.saturating_sub(state.start_time);
    
    axum::Json(MetricsResponse {
        timestamp: now,
        uptime_seconds: uptime,
        process_count: 0,  // Cache removed - would need different approach for production
        agent_id: state.agent_id.clone(),
    })
}

async fn processes_handler(state: axum::extract::State<AgentState>) -> impl axum::response::IntoResponse {
    let processes = collect_processes(state.max_processes)
        .await
        .unwrap_or_else(|e| {
            error!("Failed to collect processes: {}", e);
            ProcessList {
                timestamp: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
                processes: Vec::new(),
                agent_id: state.agent_id.clone(),
                hostname: get_hostname(),
                ip_address: get_local_ip(),
            }
        });
    
    axum::Json(processes)
}

#[derive(Clone)]
struct AgentState {
    agent_id: String,
    start_time: u64,
    max_processes: usize,
}

// Error types
#[derive(thiserror::Error, Debug)]
enum CollectError {
    #[error("Failed to read process data: {0}")]
    ReadProcessData(String),
    #[error("Failed to parse process info: {0}")]
    ParseProcessInfo(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}
