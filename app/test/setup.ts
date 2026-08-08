import "@testing-library/jest-dom/vitest";

// Clean up any DOM created by the previous test to keep component tests isolated.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import * as React from "react";

afterEach(() => {
  cleanup();
});

// jsdom does not implement scrollIntoView; components that scroll a container
// into view (e.g. UpdateSparkrunButton) would throw in a passive effect.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Next.js primitives used by app components. These are mocked so component
// tests can render in jsdom without the Next runtime or an image optimizer.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", props),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement("a", props, props.children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
