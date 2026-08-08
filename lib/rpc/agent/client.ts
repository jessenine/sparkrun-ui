/**
 * Local Agent Client
 * 
 * Secure client for communicating with the local sparkrun-local-agent.
 * Replaces SSH-based process collection with local HTTP calls.
 */

import type { ProcessEntry } from "../procedures/processes";

export interface AgentProcessList {
  timestamp: number;
  processes: ProcessEntry[];
  agent_id: string;
  hostname: string;
}

export interface AgentHealth {
  status: string;
  timestamp: number;
  agent_id: string;
  uptime_seconds: number;
}

export interface AgentMetrics {
  timestamp: number;
  uptime_seconds: number;
  process_count: number;
  agent_id: string;
}

const DEFAULT_AGENT_URL = "http://127.0.0.1:8081";
const AGENT_TIMEOUT_MS = 5000;

/**
 * Get the agent base URL from environment or use default
 */
export function getAgentBaseUrl(): string {
  return process.env.SPARKRUN_AGENT_URL || DEFAULT_AGENT_URL;
}

/**
 * Fetch with timeout support using AbortController
 */
async function fetchWithTimeout(
  url: string | URL | Request,
  options: RequestInit = {},
  timeoutMs: number = AGENT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the local agent is available
 */
export async function checkAgentHealth(): Promise<AgentHealth | null> {
  try {
    const response = await fetchWithTimeout(`${getAgentBaseUrl()}/health`);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json() as AgentHealth;
  } catch (error) {
    console.warn("[agent.client] Agent health check failed:", error);
    return null;
  }
}

/**
 * Get agent metrics
 */
export async function getAgentMetrics(): Promise<AgentMetrics | null> {
  try {
    const response = await fetchWithTimeout(`${getAgentBaseUrl()}/metrics`);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json() as AgentMetrics;
  } catch (error) {
    console.warn("[agent.client] Failed to get agent metrics:", error);
    return null;
  }
}

/**
 * Get process list from a local agent
 * 
 * @param baseUrl - Base URL of the agent (default: localhost:8081)
 * @param maxProcesses - Maximum number of processes to return (default: 5)
 * @returns Process list with top processes by CPU
 */
export async function getProcessList(
  baseUrl: string = getAgentBaseUrl(),
  maxProcesses: number = 5,
): Promise<AgentProcessList | null> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/processes`, {
      headers: {
        "Accept": "application/json",
        "X-Agent-Request": "sparkrun-ui",
      },
    });
    
    if (!response.ok) {
      console.error(`[agent.client] Agent returned status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data as AgentProcessList;
  } catch (error: unknown) {
    console.error(`[agent.client] Failed to get process list from ${baseUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Query a local agent and return top N processes sorted by CPU
 * 
 * This is the main function used by the UI - it handles both success and failure cases
 * and returns empty arrays on errors to prevent UI breaking.
 * 
 * @param host - Host to query (uses agentBaseUrl for the host, default: localhost:8081)
 * @param maxProcesses - Maximum number of processes to return
 * @returns Top processes sorted by CPU usage
 */
export async function queryAgentProcesses(
  host?: string,
  maxProcesses: number = 5,
): Promise<ProcessEntry[]> {
  try {
    // Build the agent URL from the host
    // Agents run on port 8081 on each host
    const agentUrl = host ? `http://${host}:8081` : getAgentBaseUrl();
    
    const result = await getProcessList(agentUrl, maxProcesses);
    
    if (!result || !Array.isArray(result.processes)) {
      console.warn(`[agent.client] No process data received from agent at ${agentUrl}`);
      return [];
    }
    
    return result.processes;
  } catch (error: unknown) {
    console.error("[agent.client] Process query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Batch query multiple local agents
 * 
 * For cluster deployments, you'd call this with an array of agent URLs.
 * Currently only queries the local agent.
 * 
 * @param urls - Array of agent URLs to query
 * @param maxProcesses - Maximum processes per agent
 * @returns Map of host -> process list
 */
export async function queryMultipleAgents(
  urls: string[],
  maxProcesses: number = 5,
): Promise<Map<string, ProcessEntry[]>> {
  const results = new Map<string, ProcessEntry[]>();
  
  // Query each agent
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(`${url}/processes`, {
        headers: {
          "Accept": "application/json",
          "X-Agent-Request": "sparkrun-ui",
        },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const hostname = data.hostname || "unknown";
      
      results.set(hostname, data.processes || []);
    } catch (error) {
      console.warn(`[agent.client] Failed to query agent at ${url}:`, error);
    }
  }
  
  return results;
}
