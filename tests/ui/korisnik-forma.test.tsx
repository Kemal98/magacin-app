// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const dodano = vi.fn();
const izmijenjeno = vi.fn();
vi.mock("@/app/actions/korisnici", () => ({
  dodajKorisnika: async (_s: unknown, f: FormData) => {
    dodano(Object.fromEntries([...f.entries()]));
    return undefined;
  },
  izmijeniKorisnika: async (id: string, uloga: string, _s: unknown, f: FormData) => {
    izmijenjeno(id, uloga, Object.fromEntries([...f.entries()]));
    return undefined;
  },
}));

import { KorisnikForma, noviPin } from "../../app/menadzer/korisnici/korisnik-forma";
import { provjeriPin } from "../../lib/korisnici-validacija";

afterEach(() => {
  cleanup();
  dodano.mockClear();
  izmijenjeno.mockClear();
});

const objekti = [
  { id: "44444444-4444-4444-8444-444444444444", naziv: "ŠANK HOTEL" },
  { id: "55555555-5555-4555-8555-555555555555", naziv: "KUHINJA" },
];

describe("novi korisnik", () => {
  it("magacioner: ime i PIN, bez izbora objekta i lozinke", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} />);
    expect(screen.queryByLabelText("Objekat")).toBeNull();
    expect(screen.queryByLabelText(/Lozinka/)).toBeNull();
    await u.type(screen.getByLabelText(/Ime i prezime/), "Amra Hodžić");
    await u.type(screen.getByLabelText(/PIN \(šest cifara\)/), "482913");
    await u.click(screen.getByRole("button", { name: "Dodaj korisnika" }));
    expect(dodano).toHaveBeenCalledWith({ ime: "Amra Hodžić", uloga: "magacioner", pin: "482913" });
  });

  it("osoblje objekta: pojavljuje se izbor objekta", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} />);
    await u.selectOptions(screen.getByLabelText("Uloga"), "objekat");
    await u.type(screen.getByLabelText(/Ime i prezime/), "Šank osoblje");
    await u.selectOptions(screen.getByLabelText("Objekat"), objekti[0].id);
    await u.type(screen.getByLabelText(/PIN/), "907531");
    await u.click(screen.getByRole("button", { name: "Dodaj korisnika" }));
    expect(dodano).toHaveBeenCalledWith({ ime: "Šank osoblje", uloga: "objekat", objekat: objekti[0].id, pin: "907531" });
  });

  it("menadžer: e-adresa i lozinka umjesto PIN-a", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} />);
    await u.selectOptions(screen.getByLabelText("Uloga"), "menadzer");
    expect(screen.queryByLabelText(/PIN/)).toBeNull();
    await u.type(screen.getByLabelText(/Ime i prezime/), "Drugi šef");
    await u.type(screen.getByLabelText(/E-adresa/), "drugi@magacin.local");
    await u.type(screen.getByLabelText(/Lozinka/), "dovoljno-duga");
    await u.click(screen.getByRole("button", { name: "Dodaj korisnika" }));
    expect(dodano).toHaveBeenCalledWith({ ime: "Drugi šef", uloga: "menadzer", email: "drugi@magacin.local", lozinka: "dovoljno-duga" });
  });

  it("PIN prima samo cifre i najviše šest", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} />);
    const polje = screen.getByLabelText(/PIN \(šest cifara\)/) as HTMLInputElement;
    await u.type(polje, "12ab34567890");
    expect(polje.value).toBe("123456");
  });

  it("dugme „Predloži PIN“ upisuje ispravan, nejednostavan PIN", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} />);
    for (let i = 0; i < 20; i++) {
      await u.click(screen.getByRole("button", { name: "Predloži PIN" }));
      const pin = (screen.getByLabelText(/PIN \(šest cifara\)/) as HTMLInputElement).value;
      expect(provjeriPin(pin)).toBeNull();
    }
  });

  it("generisani PIN je uvijek ispravan", () => {
    for (let i = 0; i < 500; i++) expect(provjeriPin(noviPin())).toBeNull();
  });
});

describe("izmjena korisnika", () => {
  const korisnik = { id: "22222222-2222-4222-8222-222222222222", ime: "Amra", uloga: "magacioner" as const, objekat_id: null, email: null };

  it("uloga se ne može mijenjati, a prazan PIN znači da se ne mijenja", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} korisnik={korisnik} />);
    expect(screen.queryByLabelText("Uloga")).toBeNull();
    const ime = screen.getByLabelText(/Ime i prezime/);
    await u.clear(ime);
    await u.type(ime, "Amra H.");
    await u.click(screen.getByRole("button", { name: "Snimi izmjene" }));
    expect(izmijenjeno).toHaveBeenCalledWith(korisnik.id, "magacioner", { ime: "Amra H.", uloga: "magacioner", pin: "" });
  });

  it("novi PIN se šalje samo kad se upiše", async () => {
    const u = userEvent.setup();
    render(<KorisnikForma objekti={objekti} korisnik={korisnik} />);
    await u.type(screen.getByLabelText(/Novi PIN/), "907531");
    await u.click(screen.getByRole("button", { name: "Snimi izmjene" }));
    expect(izmijenjeno).toHaveBeenCalledWith(korisnik.id, "magacioner", expect.objectContaining({ pin: "907531" }));
  });

  it("osoblje objekta: objekat je unaprijed izabran", () => {
    render(
      <KorisnikForma
        objekti={objekti}
        korisnik={{ id: "x", ime: "Osoblje", uloga: "objekat", objekat_id: objekti[1].id, email: null }}
      />,
    );
    expect((screen.getByLabelText("Objekat") as HTMLSelectElement).value).toBe(objekti[1].id);
  });

  it("menadžer: prikazuje e-adresu, a lozinka nije obavezna", () => {
    render(
      <KorisnikForma
        objekti={objekti}
        korisnik={{ id: "x", ime: "Šef", uloga: "menadzer", objekat_id: null, email: "sef@magacin.local" }}
      />,
    );
    expect(screen.getByText("E-adresa: sef@magacin.local")).toBeTruthy();
    expect((screen.getByLabelText(/Nova lozinka/) as HTMLInputElement).required).toBe(false);
  });
});
