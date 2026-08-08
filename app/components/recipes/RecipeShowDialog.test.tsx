// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RecipeShowDialog } from "./RecipeShowDialog";

const show = vi.fn();
vi.mock("@/lib/rpc/client", () => ({
  rpc: { recipes: { show: (...a: unknown[]) => show(...a) } },
}));

vi.mock("@/app/components/launch/YamlEditor", () => ({
  YamlEditor: ({ value }: { value: string }) => <pre data-testid="yaml">{value}</pre>,
}));

vi.mock("@/app/components/ui/Dialog", () => {
  const Content = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  );
  const Footer = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Close = ({ render }: { render: React.ReactNode }) => render;
  const Dialog = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  Dialog.Content = Content;
  Dialog.Body = Body;
  Dialog.Footer = Footer;
  Dialog.Close = Close;
  return { Dialog };
});

vi.mock("@/app/components/ui/Button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe("RecipeShowDialog", () => {
  beforeEach(() => {
    show.mockReset();
    show.mockResolvedValue({ text: "model: qwen\n" });
  });

  const baseProps = { name: "official/qwen", open: true, onOpenChange: vi.fn() };

  it("loads and shows the recipe YAML when opened", async () => {
    render(<RecipeShowDialog {...baseProps} />);
    expect(screen.getByText("loading…")).toBeInTheDocument();
    await waitFor(() => {
      expect(show).toHaveBeenCalledWith({ name: "official/qwen" });
    });
    expect(await screen.findByText("model: qwen")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
    // Default shows the Launch link
    expect(screen.getByRole("link", { name: /launch/i })).toHaveAttribute(
      "href",
      "/launch?recipe=official%2Fqwen",
    );
  });

  it("uses the provided title", async () => {
    render(<RecipeShowDialog {...baseProps} title="QWEN TITLE" />);
    expect(screen.getByText("QWEN TITLE")).toBeInTheDocument();
  });

  it("shows an error when the show RPC fails", async () => {
    show.mockRejectedValue(new Error("fetch failed"));
    render(<RecipeShowDialog {...baseProps} name="official/errorx" />);
    expect(await screen.findByText("fetch failed")).toBeInTheDocument();
  });

  it("shows a running badge instead of the launch link when already running", async () => {
    render(<RecipeShowDialog {...baseProps} running />);
    await screen.findByText("model: qwen");
    expect(screen.getByText("already running")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /launch/i })).not.toBeInTheDocument();
  });

  it("hides the launch link when showLaunch is false", async () => {
    render(<RecipeShowDialog {...baseProps} showLaunch={false} />);
    await screen.findByText("model: qwen");
    expect(screen.queryByRole("link", { name: /launch/i })).not.toBeInTheDocument();
  });
});
