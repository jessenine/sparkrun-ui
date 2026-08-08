// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClusterStatus } from "@/lib/schemas";

const mockHealth = vi.fn();
vi.mock("@/app/components/useWorkloadHealth", () => ({
  useWorkloadHealth: (...a: unknown[]) => mockHealth(...a),
}));

const statusStream = vi.fn();
const chatStream = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: {
    status: { stream: (...a: unknown[]) => statusStream(...a) },
    chat: { stream: (...a: unknown[]) => chatStream(...a) },
  },
}));

import { ChatPage } from "./ChatPage";

function emptyGen(): AsyncGenerator<never> {
  return (async function* () {})();
}
function tokensGen(vals: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const v of vals) yield v;
  })();
}

const emptyStatus = {
  groups: {},
  solo_entries: [],
  idle_hosts: [],
  pending_ops: [],
  errors: {},
  total_containers: 0,
  host_count: 0,
} as unknown as ClusterStatus;

const statusWithInstance = {
  groups: {},
  solo_entries: [
    {
      cluster_id: "cluster-a",
      host: "192.168.1.22",
      status: "running",
      meta: { model: "Qwen2.5-7B", port: 8000, overrides: {} },
    },
  ],
  idle_hosts: [],
  pending_ops: [],
  errors: {},
  total_containers: 1,
  host_count: 1,
} as unknown as ClusterStatus;

describe("ChatPage", () => {
  beforeEach(() => {
    mockHealth.mockReset();
    statusStream.mockReset();
    chatStream.mockReset();
    statusStream.mockResolvedValue(emptyGen());
    chatStream.mockResolvedValue(tokensGen(["Hel", "lo!"]));
  });

  it("shows an empty state when no instances are running", () => {
    mockHealth.mockReturnValue({ ready: false, state: "loading" });
    render(<ChatPage initial={emptyStatus} />);
    expect(screen.getByText("No running instances")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Launch a recipe" })).toBeInTheDocument();
  });

  it("streams assistant tokens after sending a message", async () => {
    mockHealth.mockReturnValue({ ready: true, state: "ready" });
    const user = userEvent.setup();
    render(<ChatPage initial={statusWithInstance} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Hello model");
    await user.keyboard("{Enter}");

    // user message appears immediately
    expect(await screen.findByText("Hello model")).toBeInTheDocument();
    // assistant reply streams in token-by-token
    await waitFor(() => {
      expect(screen.getByText(/Hello!/)).toBeInTheDocument();
    });
    expect(chatStream).toHaveBeenCalledTimes(1);
  });

  it("disables sending when no instance is healthy", async () => {
    mockHealth.mockReturnValue({ ready: false, state: "loading" });
    const user = userEvent.setup();
    render(<ChatPage initial={statusWithInstance} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "hi");
    await user.keyboard("{Enter}");
    // No send: chat.stream never invoked.
    expect(chatStream).not.toHaveBeenCalled();
  });
});
