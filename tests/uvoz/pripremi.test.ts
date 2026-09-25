import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { pripremiUvoz, type PripremljenUvoz } from "../../lib/uvoz/pripremi";

// Pravi fajl je izvan repozitorija (poslovni podaci); test se preskače ako ga nema.
const FAJL = resolve(process.cwd(), "..", "Utrošci - zalihe.xlsx");

describe.skipIf(!existsSync(FAJL))("uvoz iz stvarnog Excela", () => {
  let uvoz: PripremljenUvoz;
  beforeAll(() => {
    uvoz = pripremiUvoz(new Uint8Array(readFileSync(FAJL)));
  });

  it("čita artikle, objekte i dobavljače", () => {
    expect(uvoz.artikli).toHaveLength(485);
    expect(uvoz.objekti).toHaveLength(21);
    expect(uvoz.dobavljaci).toHaveLength(51);
  });
  it("svi artikli imaju mjeru kg, l ili kom", () => {
    expect(uvoz.artikli.every((a) => ["kg", "l", "kom"].includes(a.mjera))).toBe(true);
  });
  it("jedinice su ujednačene (Jogurt L → l, Hurme jkg → kg)", () => {
    expect(uvoz.artikli.find((a) => a.naziv === "Jogurt")?.mjera).toBe("l");
    expect(uvoz.artikli.find((a) => a.naziv === "Hurme")?.mjera).toBe("kg");
  });
  it("objekat PIZZERIA VIDIKOVAC je samo jedan", () => {
    expect(uvoz.objekti.filter((o) => /PIZ+ERIA VIDIKOVAC/.test(o))).toEqual(["PIZZERIA VIDIKOVAC"]);
  });
  it("dobavljač bez navodnika", () => {
    expect(uvoz.dobavljaci).toContain("VPC Atom d.o.o");
  });
  it("prijedlog dijeli artikle na prehranu i materijal", () => {
    expect(uvoz.artikli.find((a) => a.naziv === "Ajax za pod 1l")?.vrsta).toBe("materijal");
    expect(uvoz.artikli.find((a) => a.naziv === "Banana")?.vrsta).toBe("prehrana");
  });
});
