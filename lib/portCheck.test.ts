import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { probePort, probePortsParallel } from "./portCheck";

async function listen() {
  const srv = createServer();
  await new Promise<void>((res) => srv.listen(0, "127.0.0.1", res));
  const addr = srv.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { srv, port };
}

describe("probePort (SC-P1-29)", () => {
  it("returns true when the port is open", async () => {
    const { srv, port } = await listen();
    try {
      await expect(probePort("127.0.0.1", port, 500)).resolves.toBe(true);
    } finally {
      srv.close();
    }
  });

  it("returns false when the port is closed", async () => {
    // Grab an ephemeral port then release it so nothing is listening.
    const { srv, port } = await listen();
    await new Promise<void>((res) => srv.close(() => res()));
    await expect(probePort("127.0.0.1", port, 300)).resolves.toBe(false);
  });

  it("returns false on an unreachable address", async () => {
    await expect(probePort("203.0.113.1", 1, 300)).resolves.toBe(false);
  });
});

describe("probePortsParallel (SC-P1-30)", () => {
  it("returns one result per host in order", async () => {
    const { srv, port } = await listen();
    try {
      const results = await probePortsParallel(["127.0.0.1", "192.0.2.1"], port);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ host: "127.0.0.1", inUse: true });
      expect(results[1]).toEqual({ host: "192.0.2.1", inUse: false });
    } finally {
      srv.close();
    }
  });
});
