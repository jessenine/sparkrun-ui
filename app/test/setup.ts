import "@testing-library/jest-dom/vitest";

// Clean up any DOM created by the previous test to keep component tests isolated.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import * as React from "react";

afterEach(() => {
  cleanup();
});

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
