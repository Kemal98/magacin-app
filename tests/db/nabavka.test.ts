import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import { kao, pripremi, type Svijet } from "./svijet";

/** Lokalni datum (Sarajevo) pomjeren za `pomak` dana. */
async function dan(db: Client, pomak = 0): Promise<string> {
  return (await db.query("select ((now() at time zone 'Europe/Sarajevo')::date + $1::int)::text as d", [pomak])).rows[0].d;
}

type Stavka = { artikal_id: string; kolicina: number; cijena: number; pakovanje_id?: string | null };

async function isporuka(
  db: Client,
  s: Svijet,
  stavke: Stavka[],
  opcije: { dobavljac?: string; datum?: string | null; dokument?: string | null; napomena?: string | null } = {},
): Promise<string> {
  await kao(db, s.magacioner);
  const { rows } = await db.query("select magacin.unesi_prijem($1, $2::jsonb, $3, $4, $5::date) as id", [
    opcije.dobavljac ?? s.dobavljac,
    JSON.stringify(stavke),
    opcije.dokument ?? null,
    opcije.napomena ?? null,
    opcije.datum ?? null,
  ]);
  return rows[0].id;
}

const pregled = async (db: Client, od: string, do_: string) =>
  (await db.query("select * from magacin.dobavljaci_nabavka($1::date, $2::date)", [od, do_])).rows;
const isporuke = async (db: Client, dobavljac: string, od: string, do_: string) =>
  (await db.query("select * from magacin.isporuke_dobavljaca($1, $2::date, $3::date)", [dobavljac, od, do_])).rows;
const artikliDobavljaca = async (db: Client, dobavljac: string, od: string, do_: string) =>
  (await db.query("select * from magacin.artikli_dobavljaca($1, $2::date, $3::date)", [dobavljac, od, do_])).rows;

const cijeloVrijeme = "2000-01-01";
/** Datum kao "GGGG-MM-DD" (klijent za bazu datume vraća kao objekte u lokalnom vremenu). */
const dat = (v: unknown): string => {
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  return String(v).slice(0, 10);
};
const dobavljacRed = (redovi: Record<string, unknown>[], naziv: string) => redovi.find((r) => r.naziv === naziv) as Record<string, unknown>;

describe("podaci o isporuci pri prijemu", () => {
  it("bilježi datum isporuke, broj otpremnice i napomenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const datum = await dan(db, -3);
      const id = await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], {
        datum, dokument: "OTP-123/26", napomena: "Došlo kamionom, jedna paleta oštećena",
      });
      const [i] = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(i).toMatchObject({ id, dokument: "OTP-123/26", napomena: "Došlo kamionom, jedna paleta oštećena", ime: "Amra" });
      expect(dat(i.datum_isporuke)).toBe(datum);
    });
  });

  it("ako se datum ne navede, isporuka je današnja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      const [i] = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(dat(i.datum_isporuke)).toBe(await dan(db));
    });
  });

  it("datum isporuke ne može biti u budućnosti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await expect(
        isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, 2) }),
      ).rejects.toThrow(/budućnosti/i);
    });
  });

  it("prijem bez dokumenta i napomene i dalje radi (prazan tekst se čuva kao ništa)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { dokument: "  ", napomena: "" });
      const [i] = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(i.dokument).toBeNull();
      expect(i.napomena).toBeNull();
    });
  });
});

describe("koliko često i koliko dolazi dobavljač", () => {
  it("broj isporuka, ukupna vrijednost, zadnja isporuka i prosječan razmak u danima", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -10) }); // 20
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 5, cijena: 4 }], { datum: await dan(db, -5) }); // 20
      await isporuka(db, s, [{ artikal_id: s.mlijeko, kolicina: 10, cijena: 1 }], { datum: await dan(db, 0) }); // 10
      const r = dobavljacRed(await pregled(db, cijeloVrijeme, await dan(db)), "Pekara");
      expect(Number(r.broj_isporuka)).toBe(3);
      expect(Number(r.ukupna_vrijednost)).toBe(50);
      expect(Number(r.prosjecna_vrijednost)).toBeCloseTo(16.6667, 3);
      expect(Number(r.prosjecan_razmak_dana)).toBe(5);
      expect(dat(r.zadnja_isporuka)).toBe(await dan(db));
    });
  });

  it("razmak se računa između uzastopnih dana isporuke, a više isporuka istog dana je jedan dolazak", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const stavka = [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }];
      await isporuka(db, s, stavka, { datum: await dan(db, -12) });
      await isporuka(db, s, stavka, { datum: await dan(db, -12) }); // isti dan
      await isporuka(db, s, stavka, { datum: await dan(db, -2) });
      const r = dobavljacRed(await pregled(db, cijeloVrijeme, await dan(db)), "Pekara");
      expect(Number(r.broj_isporuka)).toBe(3);
      expect(Number(r.prosjecan_razmak_dana)).toBe(10);
    });
  });

  it("jedna isporuka nema razmaka", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }]);
      const r = dobavljacRed(await pregled(db, cijeloVrijeme, await dan(db)), "Pekara");
      expect(r.prosjecan_razmak_dana).toBeNull();
    });
  });

  it("period sužava brojke, ali zadnja isporuka uvijek pokazuje zadnji dolazak ikad", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -40) });
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 3 }], { datum: await dan(db, -1) });
      const r = dobavljacRed(await pregled(db, await dan(db, -7), await dan(db)), "Pekara");
      expect(Number(r.broj_isporuka)).toBe(1);
      expect(Number(r.ukupna_vrijednost)).toBe(30);
      const stari = dobavljacRed(await pregled(db, await dan(db, -60), await dan(db, -30)), "Pekara");
      expect(Number(stari.broj_isporuka)).toBe(1);
      expect(dat(stari.zadnja_isporuka)).toBe(await dan(db, -1));
    });
  });

  it("dobavljač bez isporuka je na popisu s nulama, da se vidi ko nije dolazio", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await db.query("select magacin.sacuvaj_dobavljaca(null, 'Mlin Vidovići')");
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }]);
      const mlin = dobavljacRed(await pregled(db, cijeloVrijeme, await dan(db)), "Mlin Vidovići");
      expect(Number(mlin.broj_isporuka)).toBe(0);
      expect(Number(mlin.ukupna_vrijednost)).toBe(0);
      expect(mlin.zadnja_isporuka).toBeNull();
    });
  });

  it("dobavljači se ne miješaju, najveća vrijednost je prva", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      const drugi = (await db.query("select magacin.sacuvaj_dobavljaca(null, 'Mlin') as id")).rows[0].id;
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 1, cijena: 5 }]);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 5 }], { dobavljac: drugi });
      const r = await pregled(db, cijeloVrijeme, await dan(db));
      expect(r.map((x) => x.naziv)).toEqual(["Mlin", "Pekara"]);
      expect(Number(dobavljacRed(r, "Pekara").ukupna_vrijednost)).toBe(5);
    });
  });

  it("poništena (stornirana) isporuka se ne računa u brojke", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -6) });
      const pogresna = await isporuka(db, s, [{ artikal_id: s.mlijeko, kolicina: 100, cijena: 9 }], { datum: await dan(db, -1) });
      await kao(db, s.sef);
      await db.query("select magacin.storniraj_prijem($1, 'Unesena dva puta')", [pogresna]);
      const r = dobavljacRed(await pregled(db, cijeloVrijeme, await dan(db)), "Pekara");
      expect(Number(r.broj_isporuka)).toBe(1);
      expect(Number(r.ukupna_vrijednost)).toBe(20);
      expect(Number(r.stornirano)).toBe(1);
    });
  });
});

describe("pojedinačne isporuke dobavljača", () => {
  it("najnovija prva, sa stavkama, vrijednošću i razmakom od prethodne isporuke", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -8) });
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 4, cijena: 3 }, { artikal_id: s.mlijeko, kolicina: 20, cijena: 1.5 }], { datum: await dan(db, -2) });
      const r = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(r).toHaveLength(2);
      expect(dat(r[0].datum_isporuke)).toBe(await dan(db, -2));
      expect(Number(r[0].vrijednost)).toBe(42); // 12 + 30
      expect(Number(r[0].razmak_dana)).toBe(6);
      expect(r[1].razmak_dana).toBeNull(); // prva isporuka
      expect(r[0].stavke).toHaveLength(2);
      expect(r[0].stavke).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artikal: "Šećer", mjera: "kg", kolicina: 4, cijena: 3, vrijednost: 12 }),
          expect.objectContaining({ artikal: "Mlijeko", mjera: "l", kolicina: 20, cijena: 1.5, vrijednost: 30 }),
        ]),
      );
    });
  });

  it("stavka u pakovanju: količina i cijena po osnovnoj mjeri, uz podatak koliko je pakovanja stiglo", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.kafa, pakovanje_id: s.kutija, kolicina: 3, cijena: 45 }]); // 30 kg po 4,5
      const [r] = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(r.stavke[0]).toMatchObject({ artikal: "Kafa", kolicina: 30, cijena: 4.5, vrijednost: 135, pakovanje: "kutija", kolicina_pakovanja: 3 });
    });
  });

  it("stornirana isporuka ostaje na popisu s oznakom, razlogom i imenom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await db.query("select magacin.storniraj_prijem($1, 'Pogrešan dobavljač')", [id]);
      const [r] = await isporuke(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(r).toMatchObject({ stornirano: true, storno_razlog: "Pogrešan dobavljač", storno_ime: "Šef" });
    });
  });

  it("filtrira po periodu (datum isporuke, ne datum unosa)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      // Uneseno danas, ali roba je stigla prije 20 dana.
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -20) });
      expect(await isporuke(db, s.dobavljac, await dan(db, -3), await dan(db))).toHaveLength(0);
      expect(await isporuke(db, s.dobavljac, await dan(db, -25), await dan(db, -15))).toHaveLength(1);
    });
  });

  it("nepoznat dobavljač", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await expect(isporuke(db, "00000000-0000-4000-8000-000000000000", cijeloVrijeme, await dan(db))).rejects.toThrow(/dobavljač/i);
    });
  });
});

describe("artikli koje dobavljač donosi i njihove cijene", () => {
  it("zadnja, najniža, najviša i prosječna cijena te ukupna količina i vrijednost", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }], { datum: await dan(db, -20) });
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 4 }], { datum: await dan(db, -10) });
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 20, cijena: 3 }], { datum: await dan(db, -1) });
      const [a] = await artikliDobavljaca(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(a).toMatchObject({ artikal: "Šećer", mjera: "kg" });
      expect(Number(a.broj_isporuka)).toBe(3);
      expect(Number(a.kolicina)).toBe(40);
      expect(Number(a.vrijednost)).toBe(120); // 20 + 40 + 60
      expect(Number(a.najnizja_cijena)).toBe(2);
      expect(Number(a.najvisa_cijena)).toBe(4);
      expect(Number(a.zadnja_cijena)).toBe(3);
      expect(Number(a.prosjecna_cijena)).toBe(3); // 120 / 40 (ponderisano)
      expect(dat(a.zadnja_isporuka)).toBe(await dan(db, -1));
    });
  });

  it("razdvaja artikle i ne miješa druge dobavljače, najveća vrijednost prva", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      const drugi = (await db.query("select magacin.sacuvaj_dobavljaca(null, 'Mlin') as id")).rows[0].id;
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }, { artikal_id: s.mlijeko, kolicina: 10, cijena: 2 }]);
      await isporuka(db, s, [{ artikal_id: s.brasno, kolicina: 100, cijena: 1 }], { dobavljac: drugi });
      const r = await artikliDobavljaca(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(r.map((x) => x.artikal)).toEqual(["Mlijeko", "Šećer"]);
    });
  });

  it("stornirana isporuka se ne računa u cijene i količine", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      const pogresna = await isporuka(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 99 }]);
      await kao(db, s.sef);
      await db.query("select magacin.storniraj_prijem($1, 'Pogrešna cijena')", [pogresna]);
      const [a] = await artikliDobavljaca(db, s.dobavljac, cijeloVrijeme, await dan(db));
      expect(Number(a.najvisa_cijena)).toBe(2);
      expect(Number(a.kolicina)).toBe(10);
    });
  });
});

describe("ko smije gledati nabavku", () => {
  it("magacioner i menadžer smiju, objekat i neprijavljen ne smiju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const d = await dan(db);
      const radnje = [
        () => pregled(db, cijeloVrijeme, d),
        () => isporuke(db, s.dobavljac, cijeloVrijeme, d),
        () => artikliDobavljaca(db, s.dobavljac, cijeloVrijeme, d),
      ];
      await kao(db, s.magacioner);
      for (const r of radnje) await r();
      await kao(db, s.sef);
      for (const r of radnje) await r();
      await kao(db, s.sankOsoblje);
      for (const r of radnje) {
        await db.query("savepoint a");
        await expect(r()).rejects.toThrow(/nemate pravo/i);
        await db.query("rollback to savepoint a");
      }
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await expect(radnje[0]()).rejects.toThrow();
    });
  });

  it("neispravan period se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await expect(pregled(db, "2026-09-10", "2026-09-01")).rejects.toThrow(/period/i);
    });
  });
});
