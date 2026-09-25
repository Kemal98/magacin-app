import { describe, expect, it } from "vitest";
import { kolikoIma } from "../../lib/zahtjevi-kolicine";
import type { StavkaZahtjeva } from "../../lib/zahtjevi-tipovi";

const stavka = (p: Partial<StavkaZahtjeva>): StavkaZahtjeva => ({
  id: "s", artikal_id: "a", naziv: "X", mjera: "kg", bar_kod: null, pakovanje: null, pakovanje_bar_kod: null, faktor: null,
  trazena_kolicina: 5, trazena_osnovna: 5, odobrena_kolicina: null, odobrena_osnovna: null, izdana_kolicina: null,
  izdana_osnovna: null, primljena_kolicina: null, primljena_osnovna: null, razlika_osnovna: null, na_stanju: 10, ...p,
});

describe("koliko od traženog ima na stanju", () => {
  it("ima dovoljno: vrijedi tražena količina", () => {
    expect(kolikoIma(stavka({ na_stanju: 100 }), 5)).toBe(5);
  });

  it("ima manje: vrijedi ono što ima", () => {
    expect(kolikoIma(stavka({ na_stanju: 3 }), 5)).toBe(3);
  });

  it("nema ničega: nula", () => {
    expect(kolikoIma(stavka({ na_stanju: 0 }), 5)).toBe(0);
  });

  it("stanje u osnovnoj mjeri se preračunava u jedinicu pakovanja", () => {
    // 3 kutije po 10 kg = 30 kg traženo; na stanju 12 kg → 1,2 kutije
    const s = stavka({ trazena_kolicina: 3, trazena_osnovna: 30, pakovanje: "kutija", faktor: 10, na_stanju: 12 });
    expect(kolikoIma(s, 3)).toBe(1.2);
  });

  it("zaokružuje naniže na tri decimale, da se nikad ne obeća više nego što ima", () => {
    const s = stavka({ trazena_kolicina: 3, trazena_osnovna: 30, pakovanje: "kutija", faktor: 10, na_stanju: 10 / 3 });
    expect(kolikoIma(s, 3)).toBe(0.333);
  });

  it("nepoznato stanje (objekat ga ne vidi): vrijedi traženo", () => {
    expect(kolikoIma(stavka({ na_stanju: null }), 5)).toBe(5);
  });

  it("nikad ne prelazi traženu količinu i ne ide ispod nule", () => {
    expect(kolikoIma(stavka({ na_stanju: 1000 }), 2)).toBe(2);
    expect(kolikoIma(stavka({ na_stanju: -3 }), 5)).toBe(0);
  });
});
