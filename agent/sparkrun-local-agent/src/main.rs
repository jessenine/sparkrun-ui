//! SparkRun Local Agent - Secure process monitoring for cluster nodes
//! 
//! This agent runs on each cluster member node to collect process data securely.
//! It exposes a local HTTP endpoint that the UI can query instead of using SSH.

use clap::Parser;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::{Duration, SystemTime};
use tokio::sync::mpsc;
use tracing::{info, warn, error, instrument};
use uuid::Uuid;

#[derive(Parser, Debug)]
#[command(name = "sparkrun-local-agent")]
#[command(about = "Secure local process monitoring agent for SparkRun cluster")]
struct Args {
    /// Port to listen on (default: 8081)
    #[arg(short, long, default_value = "8081")]
    port: u16,

    /// Host to bind to (default: 127.0.0.1)
    #[arg(short, long, default_value = "127.0.0.1")]
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

    // Get hostname safely
    let hostname = get_hostname();

    // Collect processes using sysinfo (safe API, no shell execution)
    let mut processes = Vec::new();
    
    // Use a safe approach - read /proc directly or use sysinfo
    // sysinfo crate provides safe wrappers around system calls
    #[cfg(target_os = "linux")]
    {
        // Read process info from /proc filesystem safely
        if let Ok(proc_data) = read_proc_files() {
            processes = proc_data;
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
    })
}

/// Read process information from /proc filesystem safely
#[cfg(target_os = "linux")]
fn read_proc_files() -> Result<Vec<ProcessEntry>, CollectError> {
    use std::fs;
    use std::io::{BufRead, BufReader};
    
    let mut processes = Vec::new();
    
    // Read /proc/stat for system stats
    if let Ok(content) = fs::read_to_string("/proc/stat") {
        // Parse CPU stats if needed
    }
    
    // Iterate through /proc to find process directories
    // This is safe - we're just reading directories
    if let Ok(entries) = fs::read_dir("/proc") {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name();
            let pid_str = name.to_string_lossy();
            
            // Check if this is a numeric directory (process)
            if let Ok(pid) = pid_str.parse::<u32>() {
                if let Some(proc_info) = read_single_process(pid) {
                    processes.push(proc_info);
                }
            }
        }
    }
    
    Ok(processes)
}

/// Read information for a single process from /proc
#[cfg(target_os = "linux")]
fn read_single_process(pid: u32) -> Option<ProcessEntry> {
    use std::fs;
    use std::io::{BufRead, BufReader};
    
    // Read /proc/[pid]/stat for process stats (safe)
    let stat_path = format!("/proc/{}/stat", pid);
    if let Ok(content) = fs::read_to_string(&stat_path) {
        let stat_line = content.trim();
        
        // Parse stat file safely
        // Format: pid (comm) state ppid ...
        if let Some(lparen) = stat_line.find('(') {
            if let Some(rparen) = stat_line.rfind(')') {
                let comm = &stat_line[lparen + 1..rparen];
                
                // Split the rest
                let after_comm = &stat_line[rparen + 2..];
                let parts: Vec<&str> = after_comm.split_whitespace().collect();
                
                if parts.len() >= 13 {
                    // Parse CPU and memory info from /proc/[pid]/statm
                    let statm_path = format!("/proc/{}/statm", pid);
                    if let Ok(statm_content) = fs::read_to_string(&statm_path) {
                        let statm_parts: Vec<&str> = statm_content.trim().split_whitespace().collect();
                        
                        if statm_parts.len() >= 2 {
                            let vmsize: f32 = statm_parts[0].parse().unwrap_or(0.0);
                            let rss: f32 = statm_parts[1].parse().unwrap_or(0.0);
                            
                            // Calculate CPU% (simplified - would need more complex calculation in production)
                            // For now, use a safe approximation
                            let cpu: f32 = 0.0; // Would need to track previous readings
                            let mem: f32 = (rss * 4096.0 / 1_000_000.0).max(0.0); // MB approximation
                            
                            return Some(ProcessEntry {
                                user: get_process_user(pid).unwrap_or_else(|_| "unknown".to_string()),
                                pid,
                                cpu,
                                mem,
                                command: comm.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    None
}

/// Get process owner (user) safely
#[cfg(target_os = "linux")]
fn get_process_user(pid: u32) -> Result<String, std::io::Error> {
    use std::fs;
    use std::io::{BufRead, BufReader};
    
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
    
    // Build the application with safe routes
    let app = axum::Router::new()
        .route("/", axum::routing::get(root_handler))
        .route("/health", axum::routing::get(health_handler))
        .route("/metrics", axum::routing::get(metrics_handler))
        .route("/processes", axum::routing::get(processes_handler))
        .with_state(AgentState::new(
            args.max_processes,
            Duration::from_millis(args.interval_ms),
        ));
    
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
        process_count: state.process_cache.lock().await.len(),
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
            }
        });
    
    axum::Json(processes)
}

// Agent state
struct AgentState {
    agent_id: String,
    start_time: u64,
    max_processes: usize,
    process_cache: tokio::sync::Mutex<Vec<ProcessEntry>>,
}

impl AgentState {
    fn new(max_processes: usize, _collection_interval: Duration) -> Self {
        Self {
            agent_id: Uuid::new_v4().to_string(),
            start_time: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            max_processes,
            process_cache: tokio::sync::Mutex::new(Vec::new()),
        }
    }
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
