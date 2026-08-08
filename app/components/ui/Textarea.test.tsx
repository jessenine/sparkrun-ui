// @vitest-environment jsdom
import { it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Textarea } from "./Textarea";

it("renders a textarea and forwards props and className", () => {
  const { container } = render(
    <Textarea placeholder="notes" className="extra" defaultValue="hi" />,
  );
  const ta = container.querySelector("textarea");
  expect(ta).not.toBeNull();
  expect(ta).toHaveAttribute("placeholder", "notes");
  expect(ta).toHaveClass("extra");
  expect(ta).toHaveValue("hi");
});
