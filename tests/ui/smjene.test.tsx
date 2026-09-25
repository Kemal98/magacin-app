// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RedZaZatvaranje, ZatvorenaSmjena } from "../../lib/smjene-tipovi";

const zatvoreno = vi.fn();
const izuzetak = vi.fn();
const raspored = vi.fn();
vi.mock("@/app/actions/smjene", () => ({
  zatvoriSmjenu: async (_s: unknown, f: FormData) => {
    zatvoreno(Object.fromEntries([...f.entries()]));
    return undefined;
  },
  dodajIzuzetak: async (_s: unknown, f: FormData) => {
    izuzetak(Object.fromEntries([...f.entries()]));
    return undefined;
  },
  sacuvajRaspored: async (id: string, _s: unknown, f: FormData) => {
    raspored(id, f.getAll("naziv"), f.getAll("pocetak"), f.getAll("kraj"));
    return undefined;
  },
}));

import { IzuzetakForma } from "../../app/objekat/izuzetak/izuzetak-forma";
import { ZatvaranjeForma } from "../../app/objekat/smjena/zatvaranje-forma";
import { RasporedForma } from "../../app/menadzer/objekti/[id]/smjene/raspored-forma";
import { SmjenaKartica } from "../../app/_components/smjena-prikaz";

const redovi: RedZaZatvaranje[] = [
  { artikal_id: "a1", naziv: "Kafa", mjera: "kg", bar_kod: null, pocetno: 2, primljeno: 8, izuzeci: 1, moguce: 9 },
  { artikal_id: "a2", naziv: "Mlijeko", mjera: "l", bar_kod: null, pocetno: 0, primljeno: 5, izuzeci: 0, moguce: 5 },
  { artikal_id: "a3", naziv: "Čaj", mjera: "kom", bar_kod: null, pocetno: 0, primljeno: 0, izuzeci: 0, moguce: 0 },
];

afterEach(() => {
  cleanup();
  zatvoreno.mockClear();
  izuzetak.mockClear();
  raspored.mockClear();
});

describe("zatvaranje smjene", () => {
  it("prikazuje početno, primljeno i izuzetke, a artikle bez zalihe odvaja", () => {
    render(<ZatvaranjeForma redovi={redovi} />);
    expect(screen.getByText(/Početno 2 \+ primljeno 8 − izuzeci 1/)).toBeTruthy();
    expect(screen.getByText("Artikli na zalihi (2)")).toBeTruthy();
    expect(screen.getByText(/Ostali artikli s popisa \(1\)/)).toBeTruthy();
  });

  it("šalje završno stanje i ime osobe", async () => {
    const u = userEvent.setup();
    render(<ZatvaranjeForma redovi={redovi} />);
    await u.type(screen.getByLabelText("Završno stanje Kafa"), "6,5");
    await u.type(screen.getByLabelText("Završno stanje Mlijeko"), "3");
    await u.type(screen.getByLabelText("Ime osobe koja zatvara smjenu"), "Emir");
    await u.click(screen.getByRole("button", { name: "Zatvori smjenu" }));
    expect(zatvoreno).toHaveBeenCalledWith(
      expect.objectContaining({ ime: "Emir", zavrsno_a1: "6,5", zavrsno_a2: "3", zavrsno_a3: "" }),
    );
  });

  it("traži razlog tek kad je upisano više nego što je moguće", async () => {
    const u = userEvent.setup();
    render(<ZatvaranjeForma redovi={redovi} />);
    const kafa = screen.getByLabelText("Završno stanje Kafa");
    await u.type(kafa, "9"); // jednako mogućem (9)
    expect(screen.queryByLabelText("Razlog za Kafa")).toBeNull();
    await u.type(kafa, "5"); // 95 > 9
    expect(screen.getByLabelText("Razlog za Kafa")).toBeTruthy();
    await u.clear(kafa);
    await u.type(kafa, "10");
    await u.type(screen.getByLabelText("Razlog za Kafa"), "Dobijeno od kuhinje");
    await u.type(screen.getByLabelText("Završno stanje Mlijeko"), "5");
    await u.type(screen.getByLabelText("Ime osobe koja zatvara smjenu"), "Emir");
    await u.click(screen.getByRole("button", { name: "Zatvori smjenu" }));
    expect(zatvoreno).toHaveBeenCalledWith(
      expect.objectContaining({ zavrsno_a1: "10", razlog_a1: "Dobijeno od kuhinje" }),
    );
  });

  it("smjena se ne šalje dok artikal s zalihe nije izbrojan", async () => {
    const u = userEvent.setup();
    render(<ZatvaranjeForma redovi={redovi} />);
    await u.type(screen.getByLabelText("Završno stanje Kafa"), "5");
    await u.type(screen.getByLabelText("Ime osobe koja zatvara smjenu"), "Emir");
    await u.click(screen.getByRole("button", { name: "Zatvori smjenu" }));
    expect(zatvoreno).not.toHaveBeenCalled();
    expect(screen.getByText("Još nije upisano završno stanje za 1 artikala.")).toBeTruthy();
  });

  it("smjena se ne šalje bez imena osobe", async () => {
    const u = userEvent.setup();
    render(<ZatvaranjeForma redovi={redovi} />);
    await u.type(screen.getByLabelText("Završno stanje Kafa"), "5");
    await u.type(screen.getByLabelText("Završno stanje Mlijeko"), "3");
    await u.click(screen.getByRole("button", { name: "Zatvori smjenu" }));
    expect(zatvoreno).not.toHaveBeenCalled();
  });
});

describe("izuzetak", () => {
  const artikli = [
    { id: "a1", naziv: "Kafa", mjera: "kg", moguce: 9 },
    { id: "a2", naziv: "Mlijeko", mjera: "l", moguce: 5 },
  ];

  it("bira artikal, količinu i brzi razlog", async () => {
    const u = userEvent.setup();
    render(<IzuzetakForma artikli={artikli} />);
    expect((screen.getByRole("button", { name: "Zabilježi izuzetak" }) as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole("button", { name: /Mlijeko/ }));
    await u.type(screen.getByLabelText("Količina"), "2");
    await u.click(screen.getByRole("button", { name: "Proliveno" }));
    await u.click(screen.getByRole("button", { name: "Zabilježi izuzetak" }));
    expect(izuzetak).toHaveBeenCalledWith({ artikal: "a2", kolicina: "2", razlog: "Proliveno" });
  });

  it("razlog se može upisati i vlastitim riječima", async () => {
    const u = userEvent.setup();
    render(<IzuzetakForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: /Kafa/ }));
    await u.type(screen.getByLabelText("Količina"), "1");
    await u.type(screen.getByLabelText("Razlog (obavezno)"), "Pala vreća");
    await u.click(screen.getByRole("button", { name: "Zabilježi izuzetak" }));
    expect(izuzetak).toHaveBeenCalledWith({ artikal: "a1", kolicina: "1", razlog: "Pala vreća" });
  });

  it("bez artikala na zalihi javlja da nema šta otpisati", () => {
    render(<IzuzetakForma artikli={[]} />);
    expect(screen.getByText("Nema artikala na zalihi objekta.")).toBeTruthy();
  });
});

describe("raspored smjena (menadžer)", () => {
  it("dodaje smjenu i šalje naziv i satnicu", async () => {
    const u = userEvent.setup();
    render(<RasporedForma objekatId="obj" pocetni={[]} />);
    await u.click(screen.getByRole("button", { name: "+ Dodaj smjenu" }));
    await u.type(screen.getByLabelText("Naziv"), "Prva smjena");
    await u.type(screen.getByLabelText("Od"), "08:00");
    await u.type(screen.getByLabelText("Do"), "16:00");
    await u.click(screen.getByRole("button", { name: "Snimi smjene" }));
    expect(raspored).toHaveBeenCalledWith("obj", ["Prva smjena"], ["08:00"], ["16:00"]);
  });

  it("prikazuje postojeći raspored i omogućava uklanjanje", async () => {
    const u = userEvent.setup();
    render(
      <RasporedForma
        objekatId="obj"
        pocetni={[
          { naziv: "Prva", pocetak: "08:00", kraj: "16:00" },
          { naziv: "Druga", pocetak: "16:00", kraj: "00:00" },
        ]}
      />,
    );
    await u.click(screen.getAllByRole("button", { name: "Ukloni" })[0]);
    await u.click(screen.getByRole("button", { name: "Snimi smjene" }));
    expect(raspored).toHaveBeenCalledWith("obj", ["Druga"], ["16:00"], ["00:00"]);
  });
});

describe("prikaz zatvorene smjene", () => {
  const smjena: ZatvorenaSmjena = {
    id: "s1",
    objekat: "ŠANK HOTEL",
    naziv: "Prva smjena",
    ime_osobe: "Emir",
    zatvorena: new Date().toISOString(),
    trosak: null,
    trosak_izuzetaka: null,
    stavke: [
      { artikal: "Kafa", mjera: "kg", pocetno: 2, primljeno: 8, izuzeci: 1, zavrsno: 6, potrosnja: 3, visak: 0, razlog: null, trosak: null, trosak_izuzetaka: null },
      { artikal: "Čaj", mjera: "kom", pocetno: 0, primljeno: 0, izuzeci: 0, zavrsno: 4, potrosnja: 0, visak: 4, razlog: "Dobijeno od kuhinje", trosak: null, trosak_izuzetaka: null },
    ],
  };

  it("objekat vidi količine, ali ne vidi trošak", () => {
    render(<ul><SmjenaKartica s={smjena} /></ul>);
    expect(screen.getByText(/Zatvorio: Emir/)).toBeTruthy();
    expect(screen.getByText(/3 kg/)).toBeTruthy();
    expect(screen.queryByText(/Trošak/)).toBeNull();
    expect(screen.getByText(/Dobijeno od kuhinje/)).toBeTruthy();
  });

  it("menadžer vidi trošak potrošnje i izuzetaka odvojeno", () => {
    const s = {
      ...smjena,
      trosak: 12,
      trosak_izuzetaka: 4,
      stavke: [{ ...smjena.stavke[0], trosak: 12, trosak_izuzetaka: 4 }],
    };
    render(<ul><SmjenaKartica s={s} pokaziObjekat /></ul>);
    expect(screen.getByText(/Trošak potrošnje: 12,00 KM/)).toBeTruthy();
    expect(screen.getAllByText(/Izuzeci: 4,00 KM|\+ 4,00 KM izuzeci/).length).toBeGreaterThan(0);
  });
});
