// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueList } from "./IssueList";
import type { ValidationIssue } from "@/lib/schemas";

describe("IssueList", () => {
  it("reports a valid recipe when there are no issues", () => {
    render(<IssueList issues={[]} />);
    expect(screen.getByText("Recipe is valid.")).toBeInTheDocument();
  });

  it("renders error issues with their field and line", () => {
    const issues: ValidationIssue[] = [
      { message: "Missing model", severity: "error", field: "model", line: 3 },
    ];
    render(<IssueList issues={issues} />);
    expect(screen.getByText("Missing model")).toBeInTheDocument();
    expect(screen.getByText("model · line 3")).toBeInTheDocument();
  });

  it("renders warning issues distinctly", () => {
    const issues: ValidationIssue[] = [{ message: "Port may be in use", severity: "warning" }];
    render(<IssueList issues={issues} />);
    expect(screen.getByText("Port may be in use")).toBeInTheDocument();
  });
});
