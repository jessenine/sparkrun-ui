import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createConnection: vi.fn(),
}));

vi.mock("node:net", () => ({
  createConnection: mocks.createConnection,
}));

import { probePort, probePortsParallel } from "./portCheck";

const originalTimeout = globalThis.setTimeout;

function fakeSocket(
  events: { connect?: () => void; error?: () => void; destroy?: () => void } = {},
) {
  const listeners: Record<string, (() => void)[]> = {};
  const socket = {
    once(ev: string, cb: () => void) {
      (listeners[ev] ||= []).push(cb);
    },
    destroy: events.destroy ?? (() => {}),
    end: () => {},
    _triggerConnect() {
      listeners.connect?.forEach((cb) => cb());
    },
    _triggerError() {
      listeners.error?.forEach((cb) => cb());
    },
  };
  return socket;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("probePort", () => {
  it("resolves true on connect", async () => {
    const socket = fakeSocket();
    mocks.createConnection.mockReturnValue(socket);
    const p = probePort("h", 8000, 250);
    socket._triggerConnect();
    await expect(p).resolves.toBe(true);
  });

  it("resolves false on error", async () => {
    const socket = fakeSocket();
    mocks.createConnection.mockReturnValue(socket);
    const p = probePort("h", 8000, 250);
    socket._triggerError();
    await expect(p).resolves.toBe(false);
  });

  it("resolves false on timeout by destroying the socket", async () => {
    let timerCb: (() => void) | undefined;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((cb: () => void) => {
      timerCb = cb;
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof globalThis.setTimeout);
    const socket = fakeSocket({ destroy: () => {} });
    const destroySpy = vi.spyOn(socket, "destroy");
    mocks.createConnection.mockReturnValue(socket);
    const p = probePort("h", 8000, 250);
    timerCb?.();
    await expect(p).resolves.toBe(false);
    expect(destroySpy).toHaveBeenCalled();
    void originalTimeout;
  });
});

describe("probePortsParallel", () => {
  it("probes each host and reports inUse", async () => {
    const s1 = fakeSocket();
    const s2 = fakeSocket();
    mocks.createConnection.mockReturnValueOnce(s1).mockReturnValueOnce(s2);
    const p = probePortsParallel(["h1", "h2"], 8000);
    s1._triggerConnect();
    s2._triggerError();
    await expect(p).resolves.toEqual([
      { host: "h1", inUse: true },
      { host: "h2", inUse: false },
    ]);
  });
});
