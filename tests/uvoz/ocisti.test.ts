import { describe, expect, it } from "vitest";
import {
  bezDuplikata,
  ocistiDobavljaca,
  ocistiMjeru,
  ocistiObjekat,
  predloziVrstu,
} from "../../lib/uvoz/ocisti";

describe("ujednačavanje jedinica", () => {
  it("L i KG postaju l i kg", () => {
    expect(ocistiMjeru("L")).toEqual({ mjera: "l", promijenjena: true });
    expect(ocistiMjeru("KG")).toEqual({ mjera: "kg", promijenjena: true });
  });
  it("jkg je kg, a pak je komad", () => {
    expect(ocistiMjeru("jkg")?.mjera).toBe("kg");
    expect(ocistiMjeru("pak")?.mjera).toBe("kom");
  });
  it("ispravna jedinica (i s razmakom) ostaje ista", () => {
    expect(ocistiMjeru("kg ")).toEqual({ mjera: "kg", promijenjena: false });
  });
  it("nepoznata jedinica se odbija", () => {
    expect(ocistiMjeru("metar")).toBeNull();
  });
});

describe("objekti i dobavljači", () => {
  it("PIZERIA i PIZZERIA VIDIKOVAC se spajaju u jedan objekat", () => {
    const objekti = bezDuplikata(["PIZERIA VIDIKOVAC", "PIZZERIA VIDIKOVAC"].map(ocistiObjekat));
    expect(objekti).toEqual(["PIZZERIA VIDIKOVAC"]);
  });
  it("objekat: razmaci i mala slova se ujednačavaju", () => {
    expect(ocistiObjekat(" šank  hotel ")).toBe("ŠANK HOTEL");
  });
  it("dobavljač: navodnici i dvostruki razmaci se uklanjaju", () => {
    expect(ocistiDobavljaca('"VPC Atom" d.o.o')).toBe("VPC Atom d.o.o");
    expect(ocistiDobavljaca("PROX  d.o.o")).toBe("PROX d.o.o");
    expect(ocistiDobavljaca("T.R.AT VOĆE ")).toBe("T.R.AT VOĆE");
  });
  it("duplikati se uklanjaju bez obzira na velika slova", () => {
    expect(bezDuplikata(["Pekara", "PEKARA", "Mlin"])).toEqual(["Pekara", "Mlin"]);
  });
});

describe("prijedlog prehrana / materijal", () => {
  const materijal = [
    "Ajax za pod 1l", "Deterdžent Za suđe", "Toaletni papir 24/1", "Rukavice latex 100/1",
    "Vreće za smeće 120l 10/1", "Sapun tečni", "Suma multi", "Sred. Za staklo 750ml",
    "Čaše pvc 100/1 classic", "Tanjir plastični 100/1 mali", "Domestos 750ml",
    "Dez. Traka za WC", "Sol za mašinu za sudje glanz", "Ulje za masažu 3l",
    "Welcome 2u1 gel za kosu i tijelo 380 ml", "Kapa kuhinjska 100/1",
    "Prašak za automatsko pranje peći", "Tablete za čišćenje friteze",
  ];
  const prehrana = [
    "Brašno t-500 Đorđić kg", "Šampinjoni rezani", "Gljive (šampinjoni)", "Sol (10kg pakovanje)",
    "Tabletirana sol", "Prašak za pecivo", "Klas gel za biskvite", "Šumsko voće",
    "Čaj menta", "Čokonut krem za mazanje", "Sladoled Duo", "Maslinovo ulje", "Kafa bosanska",
    "Čaj šumsko voće SETI", "Nadjev šumsko voće", "Coca cola 2l", "Sladoled čašica",
  ];
  it.each(materijal)("%s je materijal", (n) => expect(predloziVrstu(n)).toBe("materijal"));
  it.each(prehrana)("%s je prehrana", (n) => expect(predloziVrstu(n)).toBe("prehrana"));
});
