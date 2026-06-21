// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AvatarIcon from "./AvatarIcon";

/** lucide-react renders an <svg> with a `lucide-<name>` class we can assert on. */
function iconClass(container: HTMLElement): string {
  return container.querySelector("svg")?.getAttribute("class") ?? "";
}

describe("AvatarIcon", () => {
  it("maps known avatar keys to distinct icons", () => {
    expect(iconClass(render(<AvatarIcon avatar="sprout" />).container)).toContain("lucide-sprout");
    expect(iconClass(render(<AvatarIcon avatar="globe" />).container)).toContain("lucide-globe");
    expect(iconClass(render(<AvatarIcon avatar="bike" />).container)).toContain("lucide-bike");
  });

  it("falls back to the leaf icon for unknown values", () => {
    expect(iconClass(render(<AvatarIcon avatar="mystery" />).container)).toContain("lucide-leaf");
    expect(iconClass(render(<AvatarIcon avatar="" />).container)).toContain("lucide-leaf");
  });

  it("is decorative (aria-hidden) and honors a custom className", () => {
    const { container } = render(<AvatarIcon avatar="sprout" className="w-8 h-8" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("w-8", "h-8");
  });
});
