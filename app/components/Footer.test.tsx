// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders the app name and version", () => {
    render(<Footer />);
    expect(screen.getByText(/jix-sparkrun-ui/)).toBeInTheDocument();
    expect(screen.getByText(/web UI for/)).toBeInTheDocument();
  });

  it("renders a GitHub link", () => {
    render(<Footer />);
    const github = screen.getByRole("link", { name: "View source on GitHub" });
    expect(github).toBeInTheDocument();
    expect(github.getAttribute("href")).toContain("github.com/jessenine/sparkrun-ui");
  });

  it("links out to the sparkrun project", () => {
    render(<Footer />);
    const sparkrun = screen.getByRole("link", { name: "sparkrun" });
    expect(sparkrun.getAttribute("href")).toContain("mcampa/sparkrun");
  });
});
