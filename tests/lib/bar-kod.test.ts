import { describe, expect, it } from "vitest";
import { pretrazi, type ArtikalZaUnos } from "../../lib/bar-kod";

const artikli: ArtikalZaUnos[] = [
  {
    id: "a1",
    naziv: "Kafa",
    mjera: "kg",
    bar_kod: "3850001",
    pakovanja: [{ id: "p1", naziv: "kutija", faktor: 10, bar_kod: "3850099" }],
  },
  { id: "a2", naziv: "Jabuka", mjera: "kg", bar_kod: null, pakovanja: [] },
  { id: "a3", naziv: "Čaj menta", mjera: "kom", bar_kod: "  ", pakovanja: [] },
];

describe("traženje artikla po unosu (skener ili tastatura)", () => {
  it("bar kod artikla pronalazi artikal", () => {
    expect(pretrazi(artikli, "3850001")).toEqual({ status: "nadjen", artikal: artikli[0], pakovanjeId: null });
  });

  it("bar kod pakovanja pronalazi artikal i bira to pakovanje", () => {
    expect(pretrazi(artikli, "3850099")).toEqual({ status: "nadjen", artikal: artikli[0], pakovanjeId: "p1" });
  });

  it("skener često doda razmak ili novi red na kraju", () => {
    expect(pretrazi(artikli, "3850001\n")).toMatchObject({ status: "nadjen" });
    expect(pretrazi(artikli, " 3850001 ")).toMatchObject({ status: "nadjen" });
  });

  it("tačan naziv pronalazi artikal (bez razlike u velikim slovima)", () => {
    expect(pretrazi(artikli, "jabuka")).toEqual({ status: "nadjen", artikal: artikli[1], pakovanjeId: null });
    expect(pretrazi(artikli, "ČAJ MENTA")).toMatchObject({ status: "nadjen", artikal: artikli[2] });
  });

  it("nepoznat bar kod javlja da kod nije pronađen", () => {
    expect(pretrazi(artikli, "9999999999")).toEqual({ status: "nepoznat_kod", kod: "9999999999" });
  });

  it("nepoznat tekst javlja da artikal nije pronađen", () => {
    expect(pretrazi(artikli, "Banana")).toEqual({ status: "nepoznat_naziv", tekst: "Banana" });
  });

  it("prazan unos je prazan", () => {
    expect(pretrazi(artikli, "  ")).toEqual({ status: "prazno" });
  });

  it("artikal bez bar koda se ne pronalazi praznim kodom", () => {
    expect(pretrazi(artikli, "")).toEqual({ status: "prazno" });
  });

  it("naziv koji je sam sastavljen od cifara se ipak nalazi po nazivu", () => {
    const s: ArtikalZaUnos[] = [{ id: "x", naziv: "1234567", mjera: "kom", bar_kod: null, pakovanja: [] }];
    expect(pretrazi(s, "1234567")).toMatchObject({ status: "nadjen" });
  });
});
