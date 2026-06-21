// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Markdown from "./Markdown";

describe("Markdown", () => {
  it("renders an h4 for a ### heading", () => {
    render(<Markdown text="### Hello" />);
    const heading = screen.getByRole("heading", { level: 4 });
    expect(heading).toHaveTextContent("Hello");
  });

  it("renders a bullet list for * items", () => {
    const { container } = render(<Markdown text={"* one\n* two"} />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("one");
    expect(items[1]).toHaveTextContent("two");
  });

  it("renders **bold** inline emphasis as <strong>", () => {
    const { container } = render(<Markdown text="a **bold** word" />);
    const strong = container.querySelector("strong");
    expect(strong).toHaveTextContent("bold");
  });

  it("applies the provided wrapper className", () => {
    const { container } = render(<Markdown text="plain" className="space-y-2" />);
    expect(container.firstChild).toHaveClass("space-y-2");
  });

  it("does not render raw HTML (text-only, injection-safe)", () => {
    const { container } = render(<Markdown text="<img src=x onerror=alert(1)>" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
