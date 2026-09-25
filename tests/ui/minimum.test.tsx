// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RedStanja } from "../../app/_components/stanje-tabela";

const snimljeno = vi.fn();
vi.mock("@/app/actions/minimum", () => ({
  postaviMinimum: async (id: string, _s: unknown, f: FormData) => {
    snimljeno(id, f.get("minimum"));
    return { snimljeno: true };
  },
}));

import { StanjeTabela } from "../../app/_components/stanje-tabela";
import { ZaNarucitiPrikaz } from "../../app/_components/za-naruciti-prikaz";
import { MinimumLista } from "../../app/magacin/minimum/minimum-lista";

const red = (p: Partial<RedStanja> & { id: string; naziv: string }): RedStanja => ({
  mjera: "kg", kolicina: 10, prosjecna_cijena: 2, vrijednost: 20, minimum: 0, ispod_minimuma: false, ...p,
});
const redovi: RedStanja[] = [
  red({ id: "a", naziv: "Kafa", kolicina: 3, vrijednost: 6, minimum: 10, ispod_minimuma: true }),
  red({ id: "b", naziv: "Šećer", kolicina: 50, vrijednost: 100, minimum: 10 }),
  red({ id: "c", naziv: "Čaj", kolicina: 0, vrijednost: 0, minimum: 5, ispod_minimuma: true }),
  red({ id: "d", naziv: "Sol", kolicina: 0, vrijednost: 0 }),
];

afterEach(() => {
  cleanup();
  snimljeno.mockClear();
});

describe("stanje magacina: minimum", () => {
  it("artikal ispod minimuma je označen crveno s oznakom i minimumom", () => {
    render(<StanjeTabela redovi={redovi} />);
    const kafa = screen.getByText("Kafa").closest("tr")!;
    expect(kafa.getAttribute("data-ispod-minimuma")).toBe("true");
    expect(kafa.className).toMatch(/bg-red-50/);
    expect(kafa.textContent).toMatch(/ISPOD MINIMUMA \(10 kg\)/);
    expect(screen.getByText("Šećer").closest("tr")!.getAttribute("data-ispod-minimuma")).toBeNull();
  });

  it("pokazuje koliko je artikala ispod minimuma", () => {
    render(<StanjeTabela redovi={redovi} />);
    expect(screen.getByRole("status").textContent).toBe("Ispod minimuma: 2 artikala");
  });

  it("artikal ispod minimuma se prikazuje i kad je zaliha nula, a obični prazan artikal ne", () => {
    render(<StanjeTabela redovi={redovi} />);
    expect(screen.getByText("Čaj")).toBeTruthy();
    expect(screen.queryByText("Sol")).toBeNull();
  });

  it("filter prikazuje samo artikle ispod minimuma", async () => {
    const u = userEvent.setup();
    render(<StanjeTabela redovi={redovi} />);
    await u.click(screen.getByLabelText("Samo ispod minimuma"));
    expect(screen.getByText("Kafa")).toBeTruthy();
    expect(screen.getByText("Čaj")).toBeTruthy();
    expect(screen.queryByText("Šećer")).toBeNull();
  });

  it("pretraga ne pravi razliku između slova s kvačicama i bez njih", async () => {
    const u = userEvent.setup();
    render(<StanjeTabela redovi={redovi} />);
    await u.type(screen.getByLabelText("Traži artikal"), "secer");
    expect(screen.getByText("Šećer")).toBeTruthy();
    expect(screen.queryByText("Kafa")).toBeNull();
  });

  it("bez artikala ispod minimuma nema crvenog upozorenja", () => {
    render(<StanjeTabela redovi={[redovi[1]]} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("zadavanje minimuma", () => {
  const artikli = [
    { id: "a", naziv: "Kafa", mjera: "kg", kolicina: 3, minimum: 10 },
    { id: "b", naziv: "Šećer", mjera: "kg", kolicina: 50, minimum: 0 },
  ];

  it("prikazuje postojeći minimum, a prazno polje za artikal bez minimuma", () => {
    render(<MinimumLista artikli={artikli} />);
    expect((screen.getByLabelText("Minimum Kafa") as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText("Minimum Šećer") as HTMLInputElement).value).toBe("");
  });

  it("snima minimum samo za artikal čije je dugme pritisnuto", async () => {
    const u = userEvent.setup();
    render(<MinimumLista artikli={artikli} />);
    const polje = screen.getByLabelText("Minimum Šećer");
    await u.type(polje, "25,5");
    await u.click(polje.closest("form")!.querySelector("button")!);
    expect(snimljeno).toHaveBeenCalledTimes(1);
    expect(snimljeno).toHaveBeenCalledWith("b", "25,5");
    expect(await screen.findByText("Snimljeno")).toBeTruthy();
  });

  it("pretraga sužava listu", async () => {
    const u = userEvent.setup();
    render(<MinimumLista artikli={artikli} />);
    await u.type(screen.getByLabelText("Traži artikal"), "šeć");
    expect(screen.queryByLabelText("Minimum Kafa")).toBeNull();
    expect(screen.getByLabelText("Minimum Šećer")).toBeTruthy();
  });
});

describe("popis za naručivanje", () => {
  it("prikazuje šta nedostaje", () => {
    render(
      <ZaNarucitiPrikaz
        artikli={[{ artikal_id: "a", naziv: "Kafa", mjera: "kg", kolicina: 3, minimum: 10, nedostaje: 7 }]}
      />,
    );
    expect(screen.getByText("Kafa")).toBeTruthy();
    expect(screen.getByText("Nedostaje 7 kg")).toBeTruthy();
    expect(screen.getByText(/Na stanju 3 kg, minimum 10 kg/)).toBeTruthy();
  });

  it("kad nema artikala ispod minimuma javlja da je sve u redu", () => {
    render(<ZaNarucitiPrikaz artikli={[]} />);
    expect(screen.getByText("Nijedan artikal nije ispod minimuma.")).toBeTruthy();
  });
});
