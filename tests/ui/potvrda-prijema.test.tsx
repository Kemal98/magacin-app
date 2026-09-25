// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Zahtjev } from "../../lib/zahtjevi-tipovi";

const potvrdjeno = vi.fn();
vi.mock("@/app/actions/zahtjevi", () => ({
  potvrdiPrimljeno: async (id: string, _s: unknown, f: FormData) => {
    potvrdjeno(id, Object.fromEntries([...f.entries()]));
    return undefined;
  },
}));

import { PotvrdaPrijema } from "../../app/objekat/potvrda-prijema";
import { ZahtjevKartica } from "../../app/_components/zahtjev-prikaz";

const stavka = (id: string, naziv: string, izdano: number, pak: { naziv: string; faktor: number } | null = null) => ({
  id,
  artikal_id: `a-${id}`,
  naziv,
  mjera: "kg",
  bar_kod: null,
  pakovanje: pak?.naziv ?? null,
  pakovanje_bar_kod: null,
  faktor: pak?.faktor ?? null,
  trazena_kolicina: izdano,
  trazena_osnovna: izdano * (pak?.faktor ?? 1),
  odobrena_kolicina: izdano,
  odobrena_osnovna: izdano * (pak?.faktor ?? 1),
  izdana_kolicina: izdano,
  izdana_osnovna: izdano * (pak?.faktor ?? 1),
  primljena_kolicina: null,
  primljena_osnovna: null,
  razlika_osnovna: null,
  na_stanju: null,
});

const zahtjev: Zahtjev = {
  id: "zzz",
  vrijeme: new Date().toISOString(),
  status: "na_dostavi",
  objekat: "ŠANK HOTEL",
  poslao: "Šank osoblje",
  odobrio: "Amra",
  odluka_vrijeme: new Date().toISOString(),
  razlog: null,
  izdao: "Amra",
  izdano_vrijeme: new Date().toISOString(),
  primio: null,
  primljeno_vrijeme: null,
  stavke: [stavka("s1", "Kafa", 3, { naziv: "kutija", faktor: 10 }), stavka("s2", "Mlijeko", 5)],
};

afterEach(() => {
  cleanup();
  potvrdjeno.mockClear();
});

describe("objekat: potvrda prijema (STIGLO)", () => {
  it("jedan dodir na STIGLO potvrđuje bez ikakvih količina", async () => {
    const u = userEvent.setup();
    render(<PotvrdaPrijema z={zahtjev} />);
    expect(screen.getByText(/Poslano: 3 kutija \(30 kg\)/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "STIGLO" }));
    expect(potvrdjeno).toHaveBeenCalledWith("zzz", {});
  });

  it("stiglo je drugačije: prikazuje polja s poslanim količinama i šalje stvarne", async () => {
    const u = userEvent.setup();
    render(<PotvrdaPrijema z={zahtjev} />);
    await u.click(screen.getByRole("button", { name: "Stiglo je drugačije" }));
    const kafa = screen.getByLabelText("Stiglo Kafa") as HTMLInputElement;
    expect(kafa.value).toBe("3");
    await u.clear(kafa);
    await u.type(kafa, "2");
    await u.click(screen.getByRole("button", { name: "POTVRDI PRIMLJENO" }));
    expect(potvrdjeno).toHaveBeenCalledWith("zzz", { primljeno_s1: "2", primljeno_s2: "5" });
  });

  it("može se predomisliti i vratiti na običan STIGLO", async () => {
    const u = userEvent.setup();
    render(<PotvrdaPrijema z={zahtjev} />);
    await u.click(screen.getByRole("button", { name: "Stiglo je drugačije" }));
    await u.click(screen.getByRole("button", { name: "Ipak je sve stiglo kako je poslano" }));
    expect(screen.queryByLabelText("Stiglo Kafa")).toBeNull();
    expect(screen.getByRole("button", { name: "STIGLO" })).toBeTruthy();
  });
});

describe("prikaz primljenog zahtjeva", () => {
  const primljen: Zahtjev = {
    ...zahtjev,
    status: "primljeno",
    primio: "Šank osoblje",
    primljeno_vrijeme: new Date().toISOString(),
    stavke: [
      { ...stavka("s1", "Kafa", 3, { naziv: "kutija", faktor: 10 }), primljena_kolicina: 2, primljena_osnovna: 20, razlika_osnovna: -10 },
      { ...stavka("s2", "Mlijeko", 5), primljena_kolicina: 5, primljena_osnovna: 5, razlika_osnovna: 0 },
    ],
  };

  it("razlika je istaknuta samo gdje postoji", () => {
    render(<ul><ZahtjevKartica z={primljen} pokaziObjekat /></ul>);
    expect(screen.getByText(/primljeno 2 kutija \(20 kg\)/)).toBeTruthy();
    expect(screen.getByText(/razlika -10 kg/)).toBeTruthy();
    expect(screen.getAllByText(/razlika/)).toHaveLength(1);
    expect(screen.getByText(/Primio: Šank osoblje/)).toBeTruthy();
  });
});
