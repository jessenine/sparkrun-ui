// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

describe("Nav", () => {
  it("renders all primary navigation links", () => {
    render(<Nav />);
    for (const label of ["Dashboard", "Recipes", "Launch", "Benchmarks", "Monitor", "Chat"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders a mobile menu toggle", () => {
    render(<Nav />);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("links to the dashboard", () => {
    render(<Nav />);
    const dashboard = screen.getByRole("link", { name: /Dashboard/ });
    expect(dashboard.getAttribute("href")).toBe("/dashboard");
  });
});
