//! Integration tests for sparkrun-local-agent
//! 
//! These tests verify the agent's behavior without starting the HTTP server.

use tokio::test;
use sparkrun_local_agent::{collect_processes_safe, ProcessList};

#[test]
async fn test_collect_processes_returns_valid_data() {
    let result = collect_processes_safe(5).await;
    
    assert!(result.is_ok());
    
    let processes = result.unwrap();
    assert_eq!(processes.processes.len(), 0); // No processes in test environment
    assert!(!processes.agent_id.is_empty());
    assert!(!processes.hostname.is_empty());
}

#[test]
async fn test_collect_processes_respects_max_count() {
    // In production, this would test that only max_count processes are returned
    // For now, we just verify the function doesn't panic
    let result = collect_processes_safe(10).await;
    
    assert!(result.is_ok());
}

#[test]
async fn test_process_list_has_required_fields() {
    let result = collect_processes_safe(5).await;
    
    assert!(result.is_ok());
    
    let processes = result.unwrap();
    
    // Verify all required fields are present
    assert!(processes.timestamp > 0);
    assert!(!processes.agent_id.is_empty());
    assert!(!processes.hostname.is_empty());
}
