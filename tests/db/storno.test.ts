import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import {
  jedan,
  kao,
  knjigaObjekta,
  odbij,
  odobri,
  posalji,
  pripremi,
  uZalihuObjekta,
  zalihaObjekta,
  zatvori,
  type Svijet,
} from "./svijet";

async function prijem(db: Client, s: Svijet, stavke: { artikal_id: string; kolicina: number; cijena: number }[]) {
  await kao(db, s.magacioner);
  const { rows } = await db.query("select magacin.unesi_prijem($1, $2::jsonb) as id", [s.dobavljac, JSON.stringify(stavke)]);
  return rows[0].id as string;
}

/** Magacin primi `naStanju`, objekat traži `izdato`, magacioner odobri i izda; zahtjev je na dostavi. */
async function naStanjeIIzdato(db: Client, s: Svijet, artikal: string, naStanju: number, cijena: number, izdato: number) {
  await prijem(db, s, [{ artikal_id: artikal, kolicina: naStanju, cijena }]);
  await kao(db, s.sankOsoblje);
  const id = await posalji(db, [{ artikal_id: artikal, kolicina: izdato }]);
  await kao(db, s.magacioner);
  await odobri(db, id);
  await db.query("select magacin.izdaj_zahtjev($1)", [id]);
  return id;
}

const stornirajPrijem = (db: Client, id: string, razlog: string) =>
  db.query("select magacin.storniraj_prijem($1, $2)", [id, razlog]);
const stornirajIzdavanje = (db: Client, id: string, razlog: string) =>
  db.query("select magacin.storniraj_izdavanje($1, $2)", [id, razlog]);
const stornirajOtpis = (db: Client, id: string | number, razlog: string) =>
  db.query("select magacin.storniraj_otpis($1, $2)", [id, razlog]);

const stanje = async (db: Client, artikal: string) => {
  const { rows } = await db.query(
    "select kolicina, prosjecna_cijena from magacin.zaliha_magacina where artikal_id = $1",
    [artikal],
  );
  return rows[0] ? { kolicina: Number(rows[0].kolicina), cijena: Number(rows[0].prosjecna_cijena) } : undefined;
};

const knjigaMagacina = async (db: Client, vrsta: string) =>
  (
    await db.query(
      "select id, kolicina, cijena, korisnik_id, napomena from magacin.kretanje_magacina where vrsta = $1 order by id",
      [vrsta],
    )
  ).rows.map((r) => ({ ...r, kolicina: Number(r.kolicina), cijena: Number(r.cijena) }));

const pregled = async (db: Client) => (await db.query("select * from magacin.storno_pregled(50)")).rows;

async function idOtpisa(db: Client) {
  const { rows } = await db.query("select id from magacin.kretanje_magacina where vrsta = 'otpis' order by id desc limit 1");
  return rows[0].id as string;
}

describe("storno prijema", () => {
  it("vraća stanje i prosječnu cijenu kao da tog prijema nije bilo", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      const b = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 4 }]);
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 20, cijena: 3 });
      await kao(db, s.sef);
      await stornirajPrijem(db, b, "Pogrešna količina na računu");
      const st = await stanje(db, s.secer);
      expect(st?.kolicina).toBe(10);
      expect(st?.cijena).toBeCloseTo(2, 10);
    });
  });

  it("original ostaje u knjizi, a storno je novi zapis s obrnutim predznakom i razlogom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Unesen dvaput");
      const prijemi = await knjigaMagacina(db, "prijem");
      expect(prijemi).toHaveLength(1);
      expect(prijemi[0]).toMatchObject({ kolicina: 10, cijena: 2 });
      const storno = await knjigaMagacina(db, "storno_prijema");
      expect(storno).toHaveLength(1);
      expect(storno[0]).toMatchObject({ kolicina: -10, cijena: 2, korisnik_id: s.sef, napomena: "Unesen dvaput" });
    });
  });

  it("bilježi ko je i kada poništio i zašto, a original ostaje vidljiv s oznakom storna", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Unesen dvaput");
      const [p] = (await pregled(db)).filter((x) => x.vrsta === "prijem");
      expect(p).toMatchObject({ id, stornirano: true, storno_razlog: "Unesen dvaput", storno_ime: "Šef" });
      expect(Math.abs(Date.now() - new Date(p.storno_vrijeme).getTime())).toBeLessThan(60_000);
      expect(p.opis).toMatch(/Pekara.*Šećer/);
      expect(Number(p.vrijednost)).toBe(20);
    });
  });

  it("prijem s više stavki se poništava u cijelosti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [
        { artikal_id: s.secer, kolicina: 10, cijena: 2 },
        { artikal_id: s.mlijeko, kolicina: 5, cijena: 1 },
      ]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Pogrešan dobavljač");
      expect((await stanje(db, s.secer))?.kolicina).toBe(0);
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(0);
    });
  });

  it("ne može ako je roba već izdata: stanje ne smije otići u minus, i ništa se ne mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const a = await prijem(db, s, [{ artikal_id: s.cokolada, kolicina: 10, cijena: 4 }]);
      await kao(db, s.sankOsoblje);
      const z = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 8 }]);
      await kao(db, s.magacioner);
      await odobri(db, z);
      await db.query("select magacin.izdaj_zahtjev($1)", [z]);
      await kao(db, s.sef);
      await db.query("savepoint a");
      await expect(stornirajPrijem(db, a, "Greška")).rejects.toThrow(/već izdat ili otpisan/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(2);
      expect(await knjigaMagacina(db, "storno_prijema")).toHaveLength(0);
    });
  });

  it("poništavanje jedne stavke koja ne prolazi poništava cijeli storno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [
        { artikal_id: s.secer, kolicina: 10, cijena: 2 },
        { artikal_id: s.mlijeko, kolicina: 5, cijena: 1 },
      ]);
      await kao(db, s.magacioner);
      await db.query("select magacin.otpisi_iz_magacina($1, 5, 'Isteklo')", [s.mlijeko]); // mlijeka nema za storno
      await kao(db, s.sef);
      await db.query("savepoint a");
      await expect(stornirajPrijem(db, id, "Greška")).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.secer))?.kolicina).toBe(10); // ni šećer nije skinut
    });
  });

  it("stanje na nuli zadržava prosječnu cijenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Greška");
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 0, cijena: 2 });
    });
  });

  it("isti prijem se ne može poništiti dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Greška");
      await db.query("savepoint a");
      await expect(stornirajPrijem(db, id, "Opet")).rejects.toThrow(/već poništen/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.secer))?.kolicina).toBe(10);
    });
  });

  it("nepostojeći prijem", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await expect(stornirajPrijem(db, "00000000-0000-4000-8000-000000000000", "Greška")).rejects.toThrow(/prijem/i);
    });
  });
});

describe("storno otpisa", () => {
  it("vraća robu na stanje po cijeni otpisa, a original ostaje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 10, cijena: 1 }]);
      await db.query("select magacin.otpisi_iz_magacina($1, 4, 'Isteklo')", [s.mlijeko]);
      const id = await idOtpisa(db);
      await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 6, cijena: 2 }]); // prosjek sada 1,5
      await kao(db, s.sef);
      await stornirajOtpis(db, id, "Rok je bio ispravan");
      // 12 × 1,5 + 4 × 1 = 22 na 16 → 1,375
      const st = await stanje(db, s.mlijeko);
      expect(st?.kolicina).toBe(12 + 4);
      expect(st?.cijena).toBeCloseTo(1.375, 10);
      expect(await knjigaMagacina(db, "otpis")).toHaveLength(1);
      expect((await knjigaMagacina(db, "storno_otpisa"))[0]).toMatchObject({ kolicina: 4, cijena: 1, korisnik_id: s.sef });
    });
  });

  it("otpis se pokazuje kao stornirano s razlogom, i ne može dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 10, cijena: 1 }]);
      await db.query("select magacin.otpisi_iz_magacina($1, 4, 'Isteklo')", [s.mlijeko]);
      const id = await idOtpisa(db);
      await kao(db, s.sef);
      await stornirajOtpis(db, id, "Rok je bio ispravan");
      const [o] = (await pregled(db)).filter((x) => x.vrsta === "otpis");
      expect(o).toMatchObject({ stornirano: true, storno_razlog: "Rok je bio ispravan" });
      await db.query("savepoint a");
      await expect(stornirajOtpis(db, id, "Opet")).rejects.toThrow(/već poništen/i);
    });
  });

  it("samo otpis se može poništiti tom radnjom (ne prijem)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 10, cijena: 1 }]);
      const { rows } = await db.query("select id from magacin.kretanje_magacina where vrsta = 'prijem'");
      await kao(db, s.sef);
      await expect(stornirajOtpis(db, rows[0].id, "Greška")).rejects.toThrow(/otpis/i);
    });
  });
});

describe("storno izdavanja", () => {
  it("dok je na dostavi: roba se vraća u magacin i skida iz zalihe objekta, zahtjev je stornirano", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 20, 4, 5);
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(15);
      await kao(db, s.sankOsoblje);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(5);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Izdato pogrešnom objektu");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(20);
      await kao(db, s.sankOsoblje);
      expect((await zalihaObjekta(db)).has("Topla čokolada")).toBe(false);
      expect((await jedan(db, z)).status).toBe("stornirano");
    });
  });

  it("primljena roba (bez razlike) se vraća s objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Pogrešna količina");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(10);
      await kao(db, s.sankOsoblje);
      expect((await zalihaObjekta(db)).has("Topla čokolada")).toBe(false);
    });
  });

  it("primljeno s manjkom: objekat gubi ono što je primio, a magacin dobija sve izdato natrag", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      await kao(db, s.sankOsoblje);
      const [st] = (await jedan(db, z)).stavke;
      await db.query("select magacin.potvrdi_primljeno($1, $2::jsonb)", [z, JSON.stringify([{ stavka_id: st.id, kolicina: 3 }])]);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(3);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Greška u izdavanju");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(10);
      await kao(db, s.sankOsoblje);
      expect((await zalihaObjekta(db)).has("Topla čokolada")).toBe(false);
    });
  });

  it("knjige: magacin dobija ulaz, objekat izlaz, a originalni zapisi ostaju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Greška");
      expect(await knjigaMagacina(db, "izdavanje")).toHaveLength(1);
      expect((await knjigaMagacina(db, "storno_izdavanja"))[0]).toMatchObject({ kolicina: 5, cijena: 4, korisnik_id: s.sef });
      const objekat = await knjigaObjekta(db, s);
      expect(objekat.map((k) => [k.vrsta, k.kolicina])).toEqual([
        ["izdavanje", 5],
        ["storno_izdavanja", -5],
      ]);
    });
  });

  it("magacin dobija robu natrag po cijeni po kojoj je izdata (ponderisano sa sadašnjom zalihom)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 10); // magacin: 0 kom, prosjek 4
      await prijem(db, s, [{ artikal_id: s.cokolada, kolicina: 10, cijena: 8 }]); // 10 kom po 8
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Greška");
      // 10 × 8 + 10 × 4 = 120 na 20 → 6
      const st = await stanje(db, s.cokolada);
      expect(st?.kolicina).toBe(20);
      expect(st?.cijena).toBeCloseTo(6, 10);
    });
  });

  it("izdavanje se vidi kao stornirano s razlogom i imenom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Izdato pogrešnom objektu");
      const [i] = (await pregled(db)).filter((x) => x.vrsta === "izdavanje");
      expect(i).toMatchObject({ id: z, stornirano: true, storno_razlog: "Izdato pogrešnom objektu", storno_ime: "Šef" });
      expect(i.opis).toMatch(/ŠANK HOTEL.*Topla čokolada/);
      expect(Number(i.vrijednost)).toBe(20);
    });
  });

  it("ne može ako je roba u objektu već potrošena (smjena zatvorena)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 4 }]); // potrošeno 6
      await kao(db, s.sef);
      await db.query("savepoint a");
      await expect(stornirajIzdavanje(db, z, "Greška")).rejects.toThrow(/potrošena ili otpisana/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(0);
      expect(await knjigaMagacina(db, "storno_izdavanja")).toHaveLength(0);
    });
  });

  it("ne može dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Greška");
      await db.query("savepoint a");
      await expect(stornirajIzdavanje(db, z, "Opet")).rejects.toThrow(/status/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(10);
    });
  });

  it("poslan, odobren i odbijen zahtjev se ne mogu stornirati (roba nije izdata)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const poslan = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 1 }]);
      const odobren = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 1 }]);
      const odbijen = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 1 }]);
      await kao(db, s.magacioner);
      await odobri(db, odobren);
      await odbij(db, odbijen, "Nema");
      await kao(db, s.sef);
      for (const id of [poslan, odobren, odbijen]) {
        await db.query("savepoint a");
        await expect(stornirajIzdavanje(db, id, "Greška")).rejects.toThrow(/samo za zahtjev koji je na dostavi ili primljen/i);
        await db.query("rollback to savepoint a");
      }
    });
  });

  it("stornirani zahtjev objekat vidi sa statusom stornirano", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      await kao(db, s.sef);
      await stornirajIzdavanje(db, z, "Greška");
      await kao(db, s.sankOsoblje);
      expect((await jedan(db, z)).status).toBe("stornirano");
    });
  });
});

describe("opća pravila storna", () => {
  it("razlog je obavezan", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await expect(stornirajPrijem(db, id, "   ")).rejects.toThrow(/razlog/i);
    });
  });

  it("samo menadžer može poništavati: magacioner, objekat i neprijavljen ne mogu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 10, cijena: 2 }]);
      await db.query("select magacin.otpisi_iz_magacina($1, 1, 'Isteklo')", [s.mlijeko]);
      const otpis = await idOtpisa(db);
      const z = await naStanjeIIzdato(db, s, s.cokolada, 10, 4, 5);
      const pokusaji = async () => {
        for (const radnja of [
          () => stornirajPrijem(db, id, "Greška"),
          () => stornirajOtpis(db, otpis, "Greška"),
          () => stornirajIzdavanje(db, z, "Greška"),
          () => pregled(db),
        ]) {
          await db.query("savepoint a");
          await expect(radnja()).rejects.toThrow(/nemate pravo|permission|prijav/i);
          await db.query("rollback to savepoint a");
        }
      };
      await kao(db, s.magacioner);
      await pokusaji();
      await kao(db, s.sankOsoblje);
      await pokusaji();
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await pokusaji();
    });
  });

  it("zapisi storna su nepromjenjivi i ne mogu se upisivati direktno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, id, "Greška");
      await db.query("savepoint a");
      await expect(db.query("delete from magacin.storno")).rejects.toThrow(/permission denied/i);
      await db.query("rollback to savepoint a");
      await db.query("reset role");
      await expect(db.query("update magacin.storno set razlog = 'x'")).rejects.toThrow(/nepromjenjiv/i);
    });
  });

  it("pregled pokazuje i poništive i već poništene radnje, najnovije prve", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const a = await prijem(db, s, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await prijem(db, s, [{ artikal_id: s.mlijeko, kolicina: 5, cijena: 1 }]);
      await kao(db, s.sef);
      await stornirajPrijem(db, a, "Greška");
      const r = (await pregled(db)).filter((x) => x.vrsta === "prijem");
      expect(r).toHaveLength(2);
      expect(r[0].stornirano).toBe(false); // novi prijem (mlijeko) je prvi
      expect(r[1].stornirano).toBe(true);
    });
  });
});
