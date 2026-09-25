// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RadnjaZaStorno } from "../../lib/storno-tipovi";
import type { Zahtjev } from "../../lib/zahtjevi-tipovi";

const stornirano = vi.fn();
vi.mock("@/app/actions/storno", () => ({
  stornirajRadnju: async (vrsta: string, id: string, _s: unknown, f: FormData) => {
    stornirano(vrsta, id, f.get("razlog"));
    return undefined;
  },
}));

import { ZahtjevKartica } from "../../app/_components/zahtjev-prikaz";
import { StornoLista } from "../../app/menadzer/storno/storno-lista";

const radnja = (p: Partial<RadnjaZaStorno> & { vrsta: RadnjaZaStorno["vrsta"]; id: string; opis: string }): RadnjaZaStorno => ({
  vrijeme: new Date().toISOString(), vrijednost: 20, ime: "Amra", stornirano: false,
  storno_razlog: null, storno_ime: null, storno_vrijeme: null, ...p,
});
const radnje: RadnjaZaStorno[] = [
  radnja({ vrsta: "prijem", id: "p1", opis: "Pekara: Šećer 10 kg" }),
  radnja({ vrsta: "izdavanje", id: "z1", opis: "ŠANK HOTEL: Kafa 5 kg" }),
  radnja({ vrsta: "otpis", id: "7", opis: "Mlijeko 3 l (Isteklo)" }),
  radnja({ vrsta: "prijem", id: "p2", opis: "Mesnica: Piletina 8 kg", stornirano: true, storno_razlog: "Unesen dvaput", storno_ime: "Šef", storno_vrijeme: new Date().toISOString() }),
];

afterEach(() => {
  cleanup();
  stornirano.mockClear();
});

describe("storno: pregled radnji", () => {
  it("prikazuje sve radnje, a poništene s oznakom, razlogom i imenom", () => {
    render(<StornoLista radnje={radnje} />);
    expect(screen.getAllByRole("button", { name: "Poništi" })).toHaveLength(3); // stornirani nema dugme
    const poništen = screen.getByText(/Mesnica/).closest("li")!;
    expect(within(poništen).getByText(/STORNIRANO: Unesen dvaput/)).toBeTruthy();
    expect(within(poništen).getByText(/Šef/)).toBeTruthy();
    expect(within(poništen).queryByRole("button", { name: "Poništi" })).toBeNull();
  });

  it("filter sužava na vrstu radnje", async () => {
    const u = userEvent.setup();
    render(<StornoLista radnje={radnje} />);
    await u.click(screen.getByRole("button", { name: "Otpisi" }));
    expect(screen.getByText(/Mlijeko 3 l/)).toBeTruthy();
    expect(screen.queryByText(/Pekara/)).toBeNull();
  });
});

describe("storno: poništavanje", () => {
  it("traži razlog i šalje vrstu, identifikator i razlog", async () => {
    const u = userEvent.setup();
    render(<StornoLista radnje={radnje} />);
    const prijem = screen.getByText(/Pekara/).closest("li")!;
    await u.click(within(prijem).getByRole("button", { name: "Poništi" }));
    await u.type(within(prijem).getByLabelText(/Razlog poništavanja/), "Pogrešna količina");
    await u.click(within(prijem).getByRole("button", { name: "Potvrdi storno" }));
    expect(stornirano).toHaveBeenCalledWith("prijem", "p1", "Pogrešna količina");
  });

  it("radi i za izdavanje i otpis", async () => {
    const u = userEvent.setup();
    render(<StornoLista radnje={radnje} />);
    for (const [tekst, vrsta, id] of [[/ŠANK HOTEL/, "izdavanje", "z1"], [/Mlijeko/, "otpis", "7"]] as const) {
      const li = screen.getByText(tekst).closest("li")!;
      await u.click(within(li).getByRole("button", { name: "Poništi" }));
      await u.type(within(li).getByLabelText(/Razlog poništavanja/), "Greška");
      await u.click(within(li).getByRole("button", { name: "Potvrdi storno" }));
      expect(stornirano).toHaveBeenLastCalledWith(vrsta, id, "Greška");
    }
  });

  it("odustajanje zatvara polje za razlog i ništa ne šalje", async () => {
    const u = userEvent.setup();
    render(<StornoLista radnje={radnje} />);
    const li = screen.getByText(/Pekara/).closest("li")!;
    await u.click(within(li).getByRole("button", { name: "Poništi" }));
    await u.click(within(li).getByRole("button", { name: "Odustani" }));
    expect(within(li).queryByLabelText(/Razlog poništavanja/)).toBeNull();
    expect(stornirano).not.toHaveBeenCalled();
  });
});

describe("stornirani zahtjev", () => {
  it("objekat vidi da je izdavanje poništeno", () => {
    const z: Zahtjev = {
      id: "z", vrijeme: new Date().toISOString(), status: "stornirano", objekat: "ŠANK HOTEL", poslao: "Osoblje",
      odobrio: "Amra", odluka_vrijeme: null, razlog: null, izdao: "Amra", izdano_vrijeme: null, primio: null, primljeno_vrijeme: null,
      stavke: [],
    };
    render(<ul><ZahtjevKartica z={z} /></ul>);
    expect(screen.getByText("Stornirano, izdavanje poništeno")).toBeTruthy();
    expect(screen.getByText(/Izdavanje je poništeno/)).toBeTruthy();
  });
});
