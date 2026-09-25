// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IzvjestajFilter, IzvjestajKartice } from "../../app/menadzer/izvjestaji/filter";
import { danasSarajevo, period } from "../../lib/period";

afterEach(cleanup);

const objekti = [
  { id: "o1", naziv: "ŠANK HOTEL" },
  { id: "o2", naziv: "KUHINJA" },
];

describe("filter izvještaja", () => {
  it("brzi izbori vode na dan, sedmicu i mjesec, uz zadržan objekat", () => {
    const danas = danasSarajevo();
    const mjesec = period("mjesec", danas);
    render(<IzvjestajFilter putanja="/menadzer/izvjestaji" od={mjesec.od} do={mjesec.do} objekat="o2" objekti={objekti} />);
    const dan = period("dan", danas);
    expect(screen.getByRole("link", { name: "Danas" }).getAttribute("href")).toBe(
      `/menadzer/izvjestaji?od=${dan.od}&do=${dan.do}&objekat=o2`,
    );
    expect(screen.getByRole("link", { name: "Ova sedmica" }).getAttribute("href")).toContain("objekat=o2");
  });

  it("izabrani period je označen kao aktivan", () => {
    const danas = danasSarajevo();
    const sedmica = period("sedmica", danas);
    render(<IzvjestajFilter putanja="/menadzer/izvjestaji" od={sedmica.od} do={sedmica.do} objekti={objekti} />);
    expect(screen.getByRole("link", { name: "Ova sedmica" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "Ovaj mjesec" }).getAttribute("aria-current")).toBeNull();
  });

  it("obrazac (GET) ima datume i izbor objekta s trenutnim vrijednostima", () => {
    render(<IzvjestajFilter putanja="/menadzer/izvjestaji" od="2026-09-01" do="2026-09-10" objekat="o1" objekti={objekti} />);
    expect((screen.getByLabelText("Od") as HTMLInputElement).value).toBe("2026-09-01");
    expect((screen.getByLabelText("Do") as HTMLInputElement).value).toBe("2026-09-10");
    expect((screen.getByLabelText("Objekat") as HTMLSelectElement).value).toBe("o1");
    expect(screen.getByRole("option", { name: "Svi objekti" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prikaži" }).closest("form")!.getAttribute("method")).toBe("get");
  });
});

describe("pogledi izvještaja", () => {
  it("prebacivanje između pogleda zadržava period i objekat", () => {
    render(<IzvjestajKartice aktivno="trosak" od="2026-09-01" do="2026-09-30" objekat="o1" />);
    expect(screen.getByRole("link", { name: "Izdato / potrošeno / zaliha" }).getAttribute("href")).toBe(
      "/menadzer/izvjestaji/izdato?od=2026-09-01&do=2026-09-30&objekat=o1",
    );
    expect(screen.getByRole("link", { name: "Trošak i potrošnja" }).getAttribute("aria-current")).toBe("page");
  });
});
