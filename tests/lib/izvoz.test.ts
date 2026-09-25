import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { procitajTabele } from "../../lib/uvoz/xlsx";
import { km } from "../../lib/format";
import { napraviXlsx, nazivListaZaExcel, zaokruziKm } from "../../lib/xlsx-pisanje";
import { izvjestajUListove, stanjeUListove } from "../../lib/izvoz";
import type { RedStanja } from "../../app/_components/stanje-tabela";
import type { RedIzvjestaja } from "../../lib/izvjestaji-tipovi";
import type { ZaNaruciti } from "../../lib/minimum";

const cisto = (listovi: Parameters<typeof napraviXlsx>[0]) => procitajTabele(napraviXlsx(listovi), listovi.map((l) => l.naziv));

describe("pisanje xlsx fajla", () => {
  it("brojevi, tekst i zaglavlje se čitaju natrag onako kako su upisani", () => {
    const t = cisto([
      {
        naziv: "Test",
        kolone: [
          { naslov: "Artikal", tip: "tekst" },
          { naslov: "Količina", tip: "kolicina" },
          { naslov: "Iznos (KM)", tip: "km" },
        ],
        redovi: [
          ["Kafa", 12.5, 30.125],
          ["Čaj & <šećer>", 3, 0],
        ],
      },
    ]).Test;
    expect(t[0]).toEqual({ A: "Artikal", B: "Količina", C: "Iznos (KM)" });
    expect(t[1]).toEqual({ A: "Kafa", B: "12.5", C: "30.13" }); // KM se zaokružuje na dvije decimale
    expect(t[2].A).toBe("Čaj & <šećer>");
    expect(Number(t[2].B)).toBe(3);
  });

  it("prazna ćelija ostaje prazna, a razmaci u tekstu se čuvaju u fajlu", () => {
    const fajl = napraviXlsx([
      { naziv: "P", kolone: [{ naslov: "A", tip: "tekst" }, { naslov: "B", tip: "broj" }], redovi: [["  x  ", null]] },
    ]);
    expect(procitajTabele(fajl, ["P"]).P[1].B).toBeUndefined();
    const sirovo = strFromU8(unzipSync(fajl)["xl/worksheets/sheet1.xml"]);
    expect(sirovo).toContain('<t xml:space="preserve">  x  </t>');
  });

  it("više listova, s ispravnim nazivima", () => {
    const t = cisto([
      { naziv: "Prvi", kolone: [{ naslov: "A", tip: "tekst" }], redovi: [["1"]] },
      { naziv: "Drugi list", kolone: [{ naslov: "B", tip: "tekst" }], redovi: [["2"]] },
    ]);
    expect(t.Prvi[1].A).toBe("1");
    expect(t["Drugi list"][1].A).toBe("2");
  });

  it("zabranjeni znakovi u nazivu lista se zamjenjuju, a predugi naziv skraćuje na 31 znak", () => {
    expect(nazivListaZaExcel("Trošak/potrošnja: [ukupno] * ?")).toBe("Trošak potrošnja ukupno");
    expect(nazivListaZaExcel("A".repeat(50))).toHaveLength(31);
    expect(nazivListaZaExcel("///")).toBe("List");
  });

  it("dva lista istog naziva (bez obzira na velika slova) dobijaju različite nazive", () => {
    const t = procitajTabele(
      napraviXlsx([
        { naziv: "Isti", kolone: [{ naslov: "A", tip: "tekst" }], redovi: [["1"]] },
        { naziv: "ISTI", kolone: [{ naslov: "A", tip: "tekst" }], redovi: [["2"]] },
      ]),
      ["Isti", "ISTI 2"],
    );
    expect(t.Isti[1].A).toBe("1");
    expect(t["ISTI 2"][1].A).toBe("2");
  });

  it("znakovi koje XML ne dozvoljava se izbacuju, pa je fajl uvijek ispravan", () => {
    const t = cisto([{ naziv: "X", kolone: [{ naslov: "A", tip: "tekst" }], redovi: [["a\u0001b\u000Bc"]] }]).X;
    expect(t[1].A).toBe("abc");
  });

  it("KM zaokruženo na dvije decimale jednako je onome što prikazuje ekran", () => {
    let nejednakih = 0;
    for (let i = 0; i < 20000; i++) {
      const v = Math.round(Math.random() * 1_000_000) / 1000; // do tri decimale
      const naEkranu = Number(km(v).replace(/\./g, "").replace(",", ".").replace(" KM", ""));
      if (zaokruziKm(v) !== naEkranu) nejednakih++;
    }
    expect(nejednakih).toBe(0);
  });

  it("veliki broj redova (kao cijeli šifrarnik)", () => {
    const redovi = Array.from({ length: 2000 }, (_, i) => [`Artikal ${i}`, i, i * 1.5]);
    const t = cisto([
      { naziv: "V", kolone: [{ naslov: "A", tip: "tekst" }, { naslov: "B", tip: "broj" }, { naslov: "C", tip: "km" }], redovi },
    ]).V;
    expect(t).toHaveLength(2001);
    expect(t[2000]).toEqual({ A: "Artikal 1999", B: "1999", C: "2998.5" });
  });
});

const stanje: RedStanja[] = [
  { id: "a", naziv: "Kafa", mjera: "kg", kolicina: 3, prosjecna_cijena: 12.345, vrijednost: 37.035, minimum: 10, ispod_minimuma: true },
  { id: "b", naziv: "Šećer", mjera: "kg", kolicina: 50, prosjecna_cijena: 2, vrijednost: 100, minimum: 0, ispod_minimuma: false },
];
const naruciti: ZaNaruciti[] = [{ artikal_id: "a", naziv: "Kafa", mjera: "kg", kolicina: 3, minimum: 10, nedostaje: 7 }];

describe("izvoz stanja magacina", () => {
  const t = () => {
    const l = stanjeUListove(stanje, naruciti);
    return procitajTabele(napraviXlsx(l), l.map((x) => x.naziv));
  };

  it("sadrži svaki artikal s količinom, prosječnom cijenom i vrijednošću, kako je na ekranu", () => {
    const s = t()["Stanje magacina"];
    expect(s[0].A).toBe("Artikal");
    expect(s[1]).toMatchObject({ A: "Kafa", B: "kg", C: "3", D: "12.35", E: "37.04", F: "10", G: "DA" });
    expect(s[2]).toMatchObject({ A: "Šećer", C: "50", E: "100", G: "NE" });
  });

  it("ukupna vrijednost na kraju jednaka je zbiru koji se prikazuje na ekranu", () => {
    const s = t()["Stanje magacina"];
    const ukupno = s[s.length - 1];
    expect(ukupno.A).toBe("UKUPNO");
    expect(Number(ukupno.E)).toBe(137.04); // 37,035 + 100 = 137,035 → 137,04 kao na ekranu
  });

  it("popis za naručivanje je poseban list", () => {
    const n = t()["Za naručivanje"];
    expect(n[1]).toMatchObject({ A: "Kafa", B: "kg", C: "3", D: "10", E: "7" });
  });
});

const izv = (p: Partial<RedIzvjestaja> & { objekat_id: string; objekat: string; artikal_id: string; artikal: string }): RedIzvjestaja => ({
  mjera: "kg", izdato: 0, manjak: 0, potroseno: 0, izuzeci: 0, visak: 0, razlika: 0, promjena_zalihe: 0, zaliha_sada: 0,
  vrijednost_izdatog: 0, trosak_potrosnje: 0, trosak_izuzetaka: 0, ...p,
});
const redovi: RedIzvjestaja[] = [
  izv({ objekat_id: "s", objekat: "ŠANK", artikal_id: "k", artikal: "Kafa", izdato: 10, potroseno: 8, razlika: 2, zaliha_sada: 2, trosak_potrosnje: 80, vrijednost_izdatog: 100 }),
  izv({ objekat_id: "s", objekat: "ŠANK", artikal_id: "m", artikal: "Mlijeko", mjera: "l", izdato: 20, potroseno: 15, izuzeci: 2, razlika: 5, zaliha_sada: 3, trosak_potrosnje: 22.5, trosak_izuzetaka: 3, vrijednost_izdatog: 30 }),
  izv({ objekat_id: "k", objekat: "KUHINJA", artikal_id: "m", artikal: "Mlijeko", mjera: "l", izdato: 50, potroseno: 40, razlika: 10, zaliha_sada: 10, trosak_potrosnje: 60, vrijednost_izdatog: 75 }),
];

describe("izvoz izvještaja", () => {
  const t = () => {
    const l = izvjestajUListove(redovi, { od: "2026-09-01", do: "2026-09-30", objekat: "Svi objekti", izvezao: "Šef", izvezeno: "2026-09-25" });
    return procitajTabele(napraviXlsx(l), l.map((x) => x.naziv));
  };

  it("trošak i potrošnja po objektu i artiklu, s ukupnim zbirom jednakim onom na ekranu", () => {
    const s = t()["Trošak i potrošnja"];
    expect(s[0].A).toBe("Objekat");
    const podaci = s.slice(1, -1);
    expect(podaci.map((r) => [r.A, r.B])).toEqual([["KUHINJA", "Mlijeko"], ["ŠANK", "Kafa"], ["ŠANK", "Mlijeko"]].sort());
    const ukupno = s[s.length - 1];
    expect(ukupno.A).toBe("UKUPNO");
    // potrošnja 80 + 22,5 + 60 = 162,5; izuzeci 3; ukupno 165,5
    expect(Number(ukupno.E)).toBe(162.5);
    expect(Number(ukupno.G)).toBe(3);
    expect(Number(ukupno.H)).toBe(165.5);
  });

  it("zbir po objektima, najskuplji prvi", () => {
    const s = t()["Po objektu"];
    expect(s[1]).toMatchObject({ A: "ŠANK", B: "102.5", C: "3", D: "105.5" });
    expect(s[2]).toMatchObject({ A: "KUHINJA", D: "60" });
  });

  it("potrošnja po artiklu za sve objekte, najskuplji prvi", () => {
    const s = t()["Po artiklu"];
    expect(s[1]).toMatchObject({ A: "Mlijeko", B: "l", C: "55" }); // 15 + 40
    expect(Number(s[1].F)).toBe(85.5); // 22,5 + 3 + 60
  });

  it("izdato, potrošeno, razlika i zaliha objekta uz izuzetke, manjak i višak", () => {
    const s = t()["Izdato i potrošeno"];
    expect(s[0].D).toBe("Izdato");
    const kafa = s.find((r) => r.B === "Kafa")!;
    expect(kafa).toMatchObject({ A: "ŠANK", D: "10", E: "8", F: "2", K: "100" });
    expect(Number(kafa.J)).toBe(2);
  });

  it("list s podacima o izvozu: period, objekat, ko je izvezao", () => {
    const s = t().Podaci;
    const mapa = Object.fromEntries(s.map((r) => [r.A, r.B]));
    expect(mapa).toMatchObject({ Od: "2026-09-01", Do: "2026-09-30", Objekat: "Svi objekti", Izvezao: "Šef" });
  });

  it("prazan izvještaj daje listove samo sa zaglavljem i nultim zbirom", () => {
    const l = izvjestajUListove([], { od: "2026-09-01", do: "2026-09-30", objekat: "Svi objekti", izvezao: "Šef", izvezeno: "2026-09-25" });
    const s = procitajTabele(napraviXlsx(l), l.map((x) => x.naziv))["Trošak i potrošnja"];
    expect(s[s.length - 1].A).toBe("UKUPNO");
    expect(Number(s[s.length - 1].H)).toBe(0);
  });
});
