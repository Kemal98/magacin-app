import { describe, expect, it } from "vitest";
import { predloziPopis, type Utrosak } from "../../lib/uvoz/predlozi";

const baza = [
  { id: "1", naziv: "Coca cola 0,33" },
  { id: "2", naziv: "Kafa bosanska" },
  { id: "3", naziv: "Brašno" },
  { id: "4", naziv: "Limun" },
];

const utrosci: Utrosak[] = [
  { objekat: "ŠANK HOTEL", artikal: "Coca cola 0,33" },
  { objekat: "ŠANK HOTEL", artikal: "Coca cola 0,33" },
  { objekat: "ŠANK HOTEL", artikal: "kafa bosanska " }, // drugačija slova i razmak
  { objekat: "KUHINJA", artikal: "Brašno" },
  { objekat: "šank hotel", artikal: "Limun" }, // drugačija slova u objektu
  { objekat: "ŠANK HOTEL", artikal: "Nepoznat sok" },
];

describe("prijedlog popisa artikala objekta iz utrošaka", () => {
  it("predlaže artikle koje je taj objekat trošio, s brojem utrošaka", () => {
    const p = predloziPopis(utrosci, "ŠANK HOTEL", baza);
    expect(p.artikli).toEqual([
      { id: "1", naziv: "Coca cola 0,33", brojUtrosaka: 2 },
      { id: "4", naziv: "Limun", brojUtrosaka: 1 },
      { id: "2", naziv: "Kafa bosanska", brojUtrosaka: 1 },
    ].sort((a, b) => b.brojUtrosaka - a.brojUtrosaka || a.naziv.localeCompare(b.naziv, "bs")));
  });

  it("ne predlaže artikle drugih objekata", () => {
    const p = predloziPopis(utrosci, "ŠANK HOTEL", baza);
    expect(p.artikli.map((a) => a.id)).not.toContain("3");
  });

  it("javlja artikle iz utrošaka kojih nema u šifrarniku", () => {
    const p = predloziPopis(utrosci, "ŠANK HOTEL", baza);
    expect(p.nepoznati).toEqual(["Nepoznat sok"]);
  });

  it("objekat bez utrošaka nema prijedloga", () => {
    expect(predloziPopis(utrosci, "SPA CENTAR", baza)).toEqual({ artikli: [], nepoznati: [], brojUtrosaka: 0 });
  });

  it("broji sve utroške objekta", () => {
    expect(predloziPopis(utrosci, "ŠANK HOTEL", baza).brojUtrosaka).toBe(5);
  });

  it("pravopisna varijanta objekta (PIZERIA) se spaja s ispravnom", () => {
    const u: Utrosak[] = [
      { objekat: "PIZERIA VIDIKOVAC", artikal: "Brašno" },
      { objekat: "PIZZERIA VIDIKOVAC", artikal: "Limun" },
    ];
    expect(predloziPopis(u, "PIZZERIA VIDIKOVAC", baza).artikli).toHaveLength(2);
  });
});
