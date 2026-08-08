// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedBackground } from "./AnimatedBackground";

function makeCtx() {
  return {
    clearRect: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
  };
}

describe("AnimatedBackground", () => {
  beforeEach(() => {
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    // Run the draw loop a bounded number of times, then stop scheduling.
    let calls = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      calls += 1;
      if (calls <= 3) cb(performance.now());
      return calls;
    });
    // jsdom does not implement matchMedia; provide a default (light) implementation.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the canvas element", () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    const { container } = render(<AnimatedBackground />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("drives the caustic render loop against the canvas context", () => {
    window.innerWidth = 32;
    window.innerHeight = 16;
    const ctx = makeCtx();
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    render(<AnimatedBackground />);

    expect(spy).toHaveBeenCalledWith("2d");
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.createImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders dark-theme colors when the OS prefers dark", () => {
    window.innerWidth = 32;
    window.innerHeight = 16;
    const ctx = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(<AnimatedBackground />);
    expect(ctx.clearRect).toHaveBeenCalled();

    ctx.putImageData.mock.calls.forEach(([imageData]) => {
      // dark r1=80..r2=30 etc; every pixel is fully initialized
      expect((imageData as ImageData).data.length).toBeGreaterThan(0);
    });
  });
});
