// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtikalZaUnos } from "../../lib/bar-kod";
import type { Zahtjev } from "../../lib/zahtjevi-tipovi";

const poslano = vi.fn();
const odobreno = vi.fn();
const odbijeno = vi.fn();
const osvjezi = vi.fn();
const izdato = vi.fn();

vi.mock("@/app/actions/zahtjevi", () => ({
  posaljiZahtjev: async (_s: unknown, f: FormData) => {
    poslano({ artikal: f.getAll("artikal"), pakovanje: f.getAll("pakovanje"), kolicina: f.getAll("kolicina") });
    return undefined;
  },
  odobriZahtjev: async (id: string, _s: unknown, f: FormData) => {
    odobreno(id, Object.fromEntries([...f.entries()]));
    return undefined;
  },
  izdajZahtjev: async (id: string, _s: unknown, f: FormData) => {
    izdato(id, Object.fromEntries([...f.entries()]));
    return undefined;
  },
  odbijZahtjev: async (id: string, _s: unknown, f: FormData) => {
    odbijeno(id, f.get("razlog"));
    return undefined;
  },
}));
vi.mock("@/app/_components/kamera-skener", () => ({
  KameraSkener: ({ onKod, onZatvori }: { onKod: (k: string) => void; onZatvori: () => void }) => (
    <div role="dialog">
      <button onClick={() => { onKod("3850099"); onZatvori(); }}>lažni-sken</button>
    </div>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: osvjezi }) }));

import { Osvjezavac } from "../../app/_components/osvjezavac";
import { ZahtjevForma } from "../../app/objekat/zahtjev/zahtjev-forma";
import { ZahtjevObrada } from "../../app/magacin/zahtjevi/zahtjev-obrada";
import { ZahtjevIzdavanje } from "../../app/magacin/zahtjevi/zahtjev-izdavanje";

const artikli: ArtikalZaUnos[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    naziv: "Kafa",
    mjera: "kg",
    bar_kod: null,
    pakovanja: [{ id: "22222222-2222-4222-8222-222222222222", naziv: "kutija", faktor: 10 }],
  },
  { id: "33333333-3333-4333-8333-333333333333", naziv: "Mlijeko", mjera: "l", bar_kod: null, pakovanja: [] },
];

const zahtjev: Zahtjev = {
  id: "99999999-9999-4999-8999-999999999999",
  vrijeme: new Date().toISOString(),
  status: "poslan",
  objekat: "ŠANK HOTEL",
  poslao: "Šank osoblje",
  odobrio: null,
  odluka_vrijeme: null,
  razlog: null,
  izdao: null,
  izdano_vrijeme: null,
  primio: null,
  primljeno_vrijeme: null,
  stavke: [
    {
      id: "s1", artikal_id: "a1", naziv: "Kafa", mjera: "kg", pakovanje: "kutija", faktor: 10,
      trazena_kolicina: 3, trazena_osnovna: 30, odobrena_kolicina: null, odobrena_osnovna: null, izdana_kolicina: null, izdana_osnovna: null, primljena_kolicina: null, primljena_osnovna: null, razlika_osnovna: null,
      bar_kod: "3850001", pakovanje_bar_kod: "3850099", na_stanju: 12,
    },
    {
      id: "s2", artikal_id: "a2", naziv: "Mlijeko", mjera: "l", pakovanje: null, faktor: null,
      trazena_kolicina: 5, trazena_osnovna: 5, odobrena_kolicina: null, odobrena_osnovna: null, izdana_kolicina: null, izdana_osnovna: null, primljena_kolicina: null, primljena_osnovna: null, razlika_osnovna: null,
      bar_kod: null, pakovanje_bar_kod: null, na_stanju: 40,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  poslano.mockClear();
  odobreno.mockClear();
  odbijeno.mockClear();
  osvjezi.mockClear();
  izdato.mockClear();
});

describe("objekat: novi zahtjev na tabletu", () => {
  it("bez artikla u zahtjevu se ne može poslati", () => {
    render(<ZahtjevForma artikli={artikli} />);
    expect((screen.getByRole("button", { name: "Pošalji zahtjev" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dodir na artikal ga dodaje s količinom 1, a + i − mijenjaju količinu", async () => {
    const u = userEvent.setup();
    render(<ZahtjevForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: /Mlijeko/ }));
    const kol = screen.getByLabelText("Količina Mlijeko") as HTMLInputElement;
    expect(kol.value).toBe("1");
    await u.click(screen.getByLabelText("Više Mlijeko"));
    await u.click(screen.getByLabelText("Više Mlijeko"));
    expect(kol.value).toBe("3");
    await u.click(screen.getByLabelText("Manje Mlijeko"));
    expect(kol.value).toBe("2");
  });

  it("količina ne ide ispod nule", async () => {
    const u = userEvent.setup();
    render(<ZahtjevForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: /Mlijeko/ }));
    await u.click(screen.getByLabelText("Manje Mlijeko"));
    await u.click(screen.getByLabelText("Manje Mlijeko"));
    expect((screen.getByLabelText("Količina Mlijeko") as HTMLInputElement).value).toBe("0");
  });

  it("šalje artikal, izabrano pakovanje i količinu", async () => {
    const u = userEvent.setup();
    render(<ZahtjevForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: /Kafa/ }));
    await u.click(screen.getByRole("button", { name: /^kutija/ }));
    await u.click(screen.getByLabelText("Više Kafa")); // 1 → 2
    await u.click(screen.getByRole("button", { name: /Mlijeko/ }));
    await u.click(screen.getByRole("button", { name: "Pošalji zahtjev" }));
    expect(poslano).toHaveBeenCalledWith({
      artikal: ["11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333"],
      pakovanje: ["22222222-2222-4222-8222-222222222222", ""],
      kolicina: ["2", "1"],
    });
  });

  it("artikal se može ukloniti iz zahtjeva", async () => {
    const u = userEvent.setup();
    render(<ZahtjevForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: /Mlijeko/ }));
    await u.click(screen.getByRole("button", { name: "Ukloni" }));
    expect(screen.getByText("Vaš zahtjev (0)")).toBeTruthy();
  });
});

describe("magacioner: obrada zahtjeva", () => {
  it("prikazuje traženo i stanje magacina i označava nedovoljno", () => {
    const z = { ...zahtjev, stavke: [{ ...zahtjev.stavke[0], na_stanju: 12 }, { ...zahtjev.stavke[1], na_stanju: 2 }] };
    render(<ZahtjevObrada z={z} />);
    expect(screen.getByText(/Traženo: 3 kutija \(30 kg\)/)).toBeTruthy();
    expect(screen.getAllByText(/\(nedovoljno\)/)).toHaveLength(2); // 12 kg < 30 kg i 2 l < 5 l
  });

  it("odobrava puno: šalje tražene količine", async () => {
    const u = userEvent.setup();
    render(<ZahtjevObrada z={{ ...zahtjev, stavke: zahtjev.stavke.map((x) => ({ ...x, na_stanju: 1000 })) }} />);
    await u.click(screen.getByRole("button", { name: "Odobri" }));
    expect(odobreno).toHaveBeenCalledWith(zahtjev.id, { kolicina_s1: "3", kolicina_s2: "5" });
  });

  it("odobrava manju količinu", async () => {
    const u = userEvent.setup();
    render(<ZahtjevObrada z={zahtjev} />);
    const polje = screen.getByLabelText("Odobrena količina Kafa");
    await u.clear(polje);
    await u.type(polje, "1");
    await u.click(screen.getByRole("button", { name: "Odobri" }));
    expect(odobreno).toHaveBeenCalledWith(zahtjev.id, { kolicina_s1: "1", kolicina_s2: "5" });
  });

  it("odbijanje traži razlog i šalje ga", async () => {
    const u = userEvent.setup();
    render(<ZahtjevObrada z={zahtjev} />);
    expect(screen.queryByLabelText(/Razlog odbijanja/)).toBeNull();
    await u.click(screen.getByRole("button", { name: "Odbij" }));
    await u.type(screen.getByLabelText(/Razlog odbijanja/), "Nema na stanju");
    await u.click(screen.getByRole("button", { name: "Potvrdi odbijanje" }));
    expect(odbijeno).toHaveBeenCalledWith(zahtjev.id, "Nema na stanju");
    expect(odobreno).not.toHaveBeenCalled();
  });

  it("odustajanje od odbijanja vraća dugmad za odobravanje", async () => {
    const u = userEvent.setup();
    render(<ZahtjevObrada z={zahtjev} />);
    await u.click(screen.getByRole("button", { name: "Odbij" }));
    await u.click(screen.getByRole("button", { name: "Odustani" }));
    expect(screen.getByRole("button", { name: "Odobri" })).toBeTruthy();
  });
});

const odobren: Zahtjev = {
  ...zahtjev,
  status: "odobren",
  odobrio: "Amra",
  stavke: zahtjev.stavke.map((s) => ({ ...s, odobrena_kolicina: s.trazena_kolicina, odobrena_osnovna: s.trazena_osnovna })),
};

describe("magacioner: izdavanje odobrenog zahtjeva", () => {
  it("izdaje odobrene količine jednim dodirom", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={{ ...odobren, stavke: odobren.stavke.map((x) => ({ ...x, na_stanju: 1000 })) }} />);
    await u.click(screen.getByRole("button", { name: "Označi na dostavi" }));
    expect(izdato).toHaveBeenCalledWith(odobren.id, { izdaj_s1: "3", izdaj_s2: "5" });
  });

  it("može izdati manju količinu od odobrene", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={odobren} />);
    const polje = screen.getByLabelText("Izdana količina Kafa");
    await u.clear(polje);
    await u.type(polje, "1");
    await u.click(screen.getByRole("button", { name: "Označi na dostavi" }));
    expect(izdato).toHaveBeenCalledWith(odobren.id, { izdaj_s1: "1", izdaj_s2: "5" });
  });

  it("skeniranje bar koda artikla označava stavku kao provjerenu, bez slanja forme", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={odobren} />);
    await u.click(screen.getByLabelText("Skenirajte artikal"));
    await u.keyboard("3850001{Enter}");
    expect(screen.getByLabelText("provjereno")).toBeTruthy();
    expect(screen.getByText("Provjereno skeniranjem: 1 od 2")).toBeTruthy();
    expect(izdato).not.toHaveBeenCalled();
  });

  it("bar kod pakovanja također provjerava stavku, a kamera radi kao rezerva", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={odobren} />);
    await u.click(screen.getByRole("button", { name: "Kamera" }));
    await u.click(screen.getByText("lažni-sken"));
    expect(screen.getByText("Provjereno skeniranjem: 1 od 2")).toBeTruthy();
  });

  it("bar kod koji nije na zahtjevu javlja da ne odgovara nijednoj stavci", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={odobren} />);
    await u.click(screen.getByLabelText("Skenirajte artikal"));
    await u.keyboard("9999999999{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/9999999999 ne odgovara nijednoj stavci/);
  });

  it("označava stavke kojih nema dovoljno na stanju", () => {
    const z = { ...odobren, stavke: [{ ...odobren.stavke[0], na_stanju: 4 }, odobren.stavke[1]] };
    render(<ZahtjevIzdavanje z={z} />);
    expect(screen.getAllByText(/\(nedovoljno\)/)).toHaveLength(1);
  });
});

describe("odobravanje uz nedovoljno robe", () => {
  it("količina za odobravanje je unaprijed svedena na stanje (u jedinici traženja)", () => {
    // Kafa: traženo 3 kutije (30 kg), na stanju 12 kg → 1,2 kutije; Mlijeko: traženo 5, na stanju 0
    const z = { ...zahtjev, stavke: [{ ...zahtjev.stavke[0], na_stanju: 12 }, { ...zahtjev.stavke[1], na_stanju: 0 }] };
    render(<ZahtjevObrada z={z} />);
    expect((screen.getByLabelText("Odobrena količina Kafa") as HTMLInputElement).value).toBe("1.2");
    expect((screen.getByLabelText("Odobrena količina Mlijeko") as HTMLInputElement).value).toBe("0");
    expect(screen.getByText(/Nema robe: po zadanom se ne odobrava/)).toBeTruthy();
  });
});

describe("izdavanje kad nekog artikla nema na stanju", () => {
  // Kao u praksi: dvije stavke, jedne ima dovoljno, druge nema uopće.
  const zaglavljen: Zahtjev = {
    ...odobren,
    stavke: [
      { ...odobren.stavke[0], naziv: "Fresco cola", pakovanje: null, faktor: null, trazena_kolicina: 5, trazena_osnovna: 5, odobrena_kolicina: 5, odobrena_osnovna: 5, na_stanju: 500 },
      { ...odobren.stavke[1], naziv: "Voda Ella", mjera: "l", trazena_kolicina: 1, trazena_osnovna: 1, odobrena_kolicina: 1, odobrena_osnovna: 1, na_stanju: 0 },
    ],
  };

  it("količina za izdavanje je već svedena na stanje, a stavka bez robe je jasno označena", () => {
    render(<ZahtjevIzdavanje z={zaglavljen} />);
    expect((screen.getByLabelText("Izdana količina Fresco cola") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("Izdana količina Voda Ella") as HTMLInputElement).value).toBe("0");
    expect(screen.getByText("Ova stavka se neće izdati.")).toBeTruthy();
    expect(screen.getByText(/količina za izdavanje prilagođena/)).toBeTruthy();
  });

  it("može se dalje: izdaje se ono što ima, a za artikal kojeg nema šalje se nula", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={zaglavljen} />);
    await u.click(screen.getByRole("button", { name: "Označi na dostavi" }));
    expect(izdato).toHaveBeenCalledWith(odobren.id, { izdaj_s1: "5", izdaj_s2: "0" });
  });

  it("dugme „Nema na stanju“ jednim dodirom isključuje stavku iz izdavanja", async () => {
    const u = userEvent.setup();
    const z = { ...zaglavljen, stavke: zaglavljen.stavke.map((x) => ({ ...x, na_stanju: 500 })) };
    render(<ZahtjevIzdavanje z={z} />);
    await u.click(screen.getByRole("button", { name: "Nema na stanju: ne izdaj Voda Ella" }));
    expect((screen.getByLabelText("Izdana količina Voda Ella") as HTMLInputElement).value).toBe("0");
    expect(screen.getByText("Ova stavka se neće izdati.")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Označi na dostavi" }));
    expect(izdato).toHaveBeenCalledWith(odobren.id, { izdaj_s1: "5", izdaj_s2: "0" });
  });

  it("kad se ne može izdati nijedna stavka, izdavanje je isključeno i nudi se odbijanje", async () => {
    const u = userEvent.setup();
    const z = { ...zaglavljen, stavke: zaglavljen.stavke.map((x) => ({ ...x, na_stanju: 0 })) };
    render(<ZahtjevIzdavanje z={z} />);
    expect((screen.getByRole("button", { name: "Označi na dostavi" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/odbijte zahtjev uz razlog/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Ne mogu izdati: odbij zahtjev" }));
    await u.type(screen.getByLabelText(/Razlog odbijanja/), "Nema robe na stanju");
    await u.click(screen.getByRole("button", { name: "Potvrdi odbijanje" }));
    expect(odbijeno).toHaveBeenCalledWith(odobren.id, "Nema robe na stanju");
    expect(izdato).not.toHaveBeenCalled();
  });

  it("magacioner može ručno povećati ili smanjiti količinu", async () => {
    const u = userEvent.setup();
    render(<ZahtjevIzdavanje z={zaglavljen} />);
    const polje = screen.getByLabelText("Izdana količina Fresco cola");
    await u.clear(polje);
    await u.type(polje, "2");
    await u.click(screen.getByRole("button", { name: "Označi na dostavi" }));
    expect(izdato).toHaveBeenCalledWith(odobren.id, { izdaj_s1: "2", izdaj_s2: "0" });
  });
});

describe("automatsko osvježavanje ekrana", () => {
  it("ponovo učitava podatke svakih 5 sekundi dok je stranica vidljiva", () => {
    vi.useFakeTimers();
    render(<Osvjezavac />);
    expect(osvjezi).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(5000));
    expect(osvjezi).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(10000));
    expect(osvjezi).toHaveBeenCalledTimes(3);
  });

  it("ne osvježava dok je stranica skrivena, a osvježi čim postane vidljiva", () => {
    vi.useFakeTimers();
    let stanje: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => stanje);
    render(<Osvjezavac />);
    act(() => void vi.advanceTimersByTime(15000));
    expect(osvjezi).not.toHaveBeenCalled();
    stanje = "visible";
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(osvjezi).toHaveBeenCalledTimes(1);
  });

  it("prestaje osvježavati kad se ekran zatvori", () => {
    vi.useFakeTimers();
    const { unmount } = render(<Osvjezavac />);
    unmount();
    act(() => void vi.advanceTimersByTime(20000));
    expect(osvjezi).not.toHaveBeenCalled();
  });
});
