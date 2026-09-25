import { describe, expect, it } from "vitest";
import { danasSarajevo, jeDatum, period, periodIzParametara } from "../../lib/period";
import { poArtiklu, poObjektu, ukupanTrosak, zbir, type RedIzvjestaja } from "../../lib/izvjestaji-tipovi";

describe("periodi", () => {
  it("dan je sam taj datum", () => {
    expect(period("dan", "2026-09-23")).toEqual({ od: "2026-09-23", do: "2026-09-23" });
  });

  it("sedmica ide od ponedjeljka do nedjelje, iz bilo kojeg dana u njoj", () => {
    const sedmica = { od: "2026-09-21", do: "2026-09-27" };
    expect(period("sedmica", "2026-09-21")).toEqual(sedmica); // ponedjeljak
    expect(period("sedmica", "2026-09-23")).toEqual(sedmica); // srijeda
    expect(period("sedmica", "2026-09-27")).toEqual(sedmica); // nedjelja
  });

  it("sedmica preko kraja mjeseca i godine", () => {
    expect(period("sedmica", "2026-12-31")).toEqual({ od: "2026-12-28", do: "2027-01-03" });
  });

  it("mjesec ide od prvog do zadnjeg dana, i u prestupnoj godini", () => {
    expect(period("mjesec", "2026-09-15")).toEqual({ od: "2026-09-01", do: "2026-09-30" });
    expect(period("mjesec", "2028-02-10")).toEqual({ od: "2028-02-01", do: "2028-02-29" });
    expect(period("mjesec", "2026-12-31")).toEqual({ od: "2026-12-01", do: "2026-12-31" });
  });

  it("danas se računa po lokalnom vremenu Sarajeva (kasno uveče UTC je već sljedeći dan)", () => {
    expect(danasSarajevo(new Date("2026-09-25T22:30:00Z"))).toBe("2026-09-26");
    expect(danasSarajevo(new Date("2026-01-10T10:00:00Z"))).toBe("2026-01-10");
  });

  it("prepoznaje ispravne datume", () => {
    expect(jeDatum("2026-02-28")).toBe(true);
    expect(jeDatum("2026-02-30")).toBe(false);
    expect(jeDatum("26-02-28")).toBe(false);
    expect(jeDatum(undefined)).toBe(false);
  });

  it("period iz adrese: ispravan se koristi, a neispravan daje tekući mjesec", () => {
    expect(periodIzParametara("2026-09-01", "2026-09-10", "2026-09-25")).toEqual({ od: "2026-09-01", do: "2026-09-10" });
    expect(periodIzParametara("2026-09-10", "2026-09-01", "2026-09-25")).toEqual({ od: "2026-09-01", do: "2026-09-30" });
    expect(periodIzParametara(undefined, undefined, "2026-09-25")).toEqual({ od: "2026-09-01", do: "2026-09-30" });
    expect(periodIzParametara("x", "y", "2026-09-25")).toEqual({ od: "2026-09-01", do: "2026-09-30" });
  });
});

const red = (p: Partial<RedIzvjestaja> & { objekat_id: string; objekat: string; artikal_id: string; artikal: string }): RedIzvjestaja => ({
  mjera: "kg", izdato: 0, manjak: 0, potroseno: 0, izuzeci: 0, visak: 0, razlika: 0, promjena_zalihe: 0, zaliha_sada: 0,
  vrijednost_izdatog: 0, trosak_potrosnje: 0, trosak_izuzetaka: 0, ...p,
});

const redovi: RedIzvjestaja[] = [
  red({ objekat_id: "s", objekat: "ŠANK", artikal_id: "k", artikal: "Kafa", izdato: 10, potroseno: 8, trosak_potrosnje: 80, vrijednost_izdatog: 100 }),
  red({ objekat_id: "s", objekat: "ŠANK", artikal_id: "m", artikal: "Mlijeko", izdato: 20, potroseno: 15, izuzeci: 2, trosak_potrosnje: 22.5, trosak_izuzetaka: 3, vrijednost_izdatog: 30 }),
  red({ objekat_id: "k", objekat: "KUHINJA", artikal_id: "m", artikal: "Mlijeko", izdato: 50, potroseno: 40, trosak_potrosnje: 60, vrijednost_izdatog: 75 }),
  red({ objekat_id: "k", objekat: "KUHINJA", artikal_id: "b", artikal: "Brašno", izdato: 100, potroseno: 90, trosak_potrosnje: 45, vrijednost_izdatog: 50 }),
];

describe("zbirovi izvještaja", () => {
  it("ukupno trošak, izuzeci i vrijednost izdatog", () => {
    expect(zbir(redovi)).toEqual({ vrijednost_izdatog: 255, trosak_potrosnje: 207.5, trosak_izuzetaka: 3 });
  });

  it("po objektu: zbir svakog objekta, najskuplji objekat prvi, artikli unutar njega po trošku", () => {
    const g = poObjektu(redovi);
    expect(g.map((x) => x.objekat)).toEqual(["ŠANK", "KUHINJA"]);
    expect(ukupanTrosak(g[0].zbir)).toBe(105.5);
    expect(ukupanTrosak(g[1].zbir)).toBe(105);
    expect(g[0].redovi.map((r) => r.artikal)).toEqual(["Kafa", "Mlijeko"]);
    // zbir po objektima jednak je ukupnom
    expect(g.reduce((z, x) => z + ukupanTrosak(x.zbir), 0)).toBe(ukupanTrosak(zbir(redovi)));
  });

  it("po artiklu: isti artikal iz više objekata se sabira, najskuplji prvi", () => {
    const a = poArtiklu(redovi);
    expect(a.map((x) => x.artikal)).toEqual(["Mlijeko", "Kafa", "Brašno"]); // 85,5 > 80 > 45
    const mlijeko = a.find((x) => x.artikal === "Mlijeko")!;
    expect(mlijeko).toMatchObject({ izdato: 70, potroseno: 55, izuzeci: 2, trosak_potrosnje: 82.5, trosak_izuzetaka: 3 });
  });

  it("prazan izvještaj daje nule i prazne liste", () => {
    expect(zbir([])).toEqual({ vrijednost_izdatog: 0, trosak_potrosnje: 0, trosak_izuzetaka: 0 });
    expect(poObjektu([])).toEqual([]);
    expect(poArtiklu([])).toEqual([]);
  });
});
