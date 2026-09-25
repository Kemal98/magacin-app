// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IzvozDugme } from "../../app/_components/izvoz-dugme";

afterEach(cleanup);

describe("dugme za izvoz u Excel", () => {
  it("je običan link za preuzimanje (radi bez skripte)", () => {
    render(<IzvozDugme href="/izvoz/stanje" />);
    const veza = screen.getByRole("link", { name: "Izvezi u Excel" });
    expect(veza.getAttribute("href")).toBe("/izvoz/stanje");
    expect(veza.hasAttribute("download")).toBe(true);
  });

  it("nosi period i objekat iz izvještaja", () => {
    render(<IzvozDugme href="/izvoz/izvjestaj?od=2026-09-01&do=2026-09-30&objekat=o1" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/izvoz/izvjestaj?od=2026-09-01&do=2026-09-30&objekat=o1");
  });
});
