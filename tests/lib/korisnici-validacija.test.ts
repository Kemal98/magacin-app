import { describe, expect, it } from "vitest";
import { adresaZaPin, provjeriEmail, provjeriLozinku, provjeriPin } from "../../lib/korisnici-validacija";

describe("provjera PIN-a", () => {
  it("prihvata šest cifara koje nisu očigledne", () => {
    for (const pin of ["482913", "100234", "907531", "135790"]) expect(provjeriPin(pin)).toBeNull();
  });

  it("odbija pogrešnu dužinu i slova", () => {
    for (const pin of ["", "1234", "1234567", "12345a", "12 345", "١٢٣٤٥٦"]) {
      expect(provjeriPin(pin)).toBe("PIN mora imati tačno šest cifara.");
    }
  });

  it("odbija iste cifre", () => {
    for (const pin of ["000000", "111111", "999999"]) expect(provjeriPin(pin)).toMatch(/isti brojevi/);
  });

  it("odbija nizove naviše i naniže", () => {
    for (const pin of ["123456", "234567", "012345", "456789", "567890", "654321", "987654", "543210"]) {
      expect(provjeriPin(pin)).toMatch(/niz brojeva/);
    }
  });
});

describe("provjera lozinke i e-adrese", () => {
  it("lozinka ima bar 8 znakova", () => {
    expect(provjeriLozinku("kratka1")).toMatch(/8 znakova/);
    expect(provjeriLozinku("dovoljno-duga")).toBeNull();
  });

  it("e-adresa mora biti ispravna", () => {
    expect(provjeriEmail("sef@magacin.local")).toBeNull();
    expect(provjeriEmail(" sef@magacin.local ")).toBeNull();
    expect(provjeriEmail("sef")).not.toBeNull();
    expect(provjeriEmail("sef@")).not.toBeNull();
    expect(provjeriEmail("s ef@x.ba")).not.toBeNull();
  });

  it("tehnička adresa za PIN prijavu", () => {
    expect(adresaZaPin("abc")).toBe("abc@korisnik.magacin.local");
  });
});
