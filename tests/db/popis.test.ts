import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import { kao, pripremi, type Svijet } from "./svijet";

async function naStanje(db: Client, s: Svijet, artikal: string, kolicina: number, cijena: number) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
}

type Stavka = { artikal_id: string; brojano: number; sistem?: number; cijena?: number };

const pregled = async (db: Client, stavke: Stavka[]) =>
  (await db.query("select * from magacin.pregled_popisa($1::jsonb)", [JSON.stringify(stavke)])).rows;

const potvrdi = (db: Client, stavke: Stavka[], pocetno = false) =>
  db.query("select magacin.potvrdi_popis($1::jsonb, $2) as id", [JSON.stringify(stavke), pocetno]);

const stanje = async (db: Client, artikal: string) => {
  const { rows } = await db.query(
    "select kolicina, prosjecna_cijena from magacin.zaliha_magacina where artikal_id = $1",
    [artikal],
  );
  return rows[0] ? { kolicina: Number(rows[0].kolicina), cijena: Number(rows[0].prosjecna_cijena) } : undefined;
};

const knjiga = async (db: Client) =>
  (
    await db.query(
      "select vrsta, kolicina, cijena, korisnik_id, popis_id from magacin.kretanje_magacina where vrsta = 'popis' order by id",
    )
  ).rows.map((r) => ({ ...r, kolicina: Number(r.kolicina), cijena: Number(r.cijena) }));

const popisi = async (db: Client) => (await db.query("select * from magacin.popisi_magacina(50)")).rows;

describe("pregled razlika prije potvrde", () => {
  it("pokazuje sistemsko stanje, brojano stanje, razliku i njenu vrijednost", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      const [r] = await pregled(db, [{ artikal_id: s.secer, brojano: 8 }]);
      expect(r).toMatchObject({ naziv: "Šećer", mjera: "kg" });
      expect(Number(r.sistem)).toBe(10);
      expect(Number(r.brojano)).toBe(8);
      expect(Number(r.razlika)).toBe(-2);
      expect(Number(r.cijena)).toBe(4);
      expect(Number(r.vrijednost_razlike)).toBe(-8);
    });
  });

  it("pregled ništa ne mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await pregled(db, [{ artikal_id: s.secer, brojano: 3 }]);
      expect((await stanje(db, s.secer))?.kolicina).toBe(10);
      expect(await knjiga(db)).toHaveLength(0);
      expect(await popisi(db)).toHaveLength(0);
    });
  });

  it("javlja da višak artikla bez poznate cijene traži cijenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const [r] = await pregled(db, [{ artikal_id: s.secer, brojano: 5 }]);
      expect(Number(r.razlika)).toBe(5);
      expect(r.treba_cijenu).toBe(true);
    });
  });

  it("razlika nula se prikazuje bez upozorenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      const [r] = await pregled(db, [{ artikal_id: s.secer, brojano: 10 }]);
      expect(Number(r.razlika)).toBe(0);
      expect(r.treba_cijenu).toBe(false);
    });
  });
});

describe("potvrda popisa usklađuje stanje", () => {
  it("manjak: stanje pada na brojano, razlika po prosječnoj cijeni ulazi u knjigu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10 }]);
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 8, cijena: 4 });
      const k = await knjiga(db);
      expect(k).toHaveLength(1);
      expect(k[0]).toMatchObject({ kolicina: -2, cijena: 4, korisnik_id: s.magacioner });
    });
  });

  it("višak: stanje raste na brojano po postojećoj prosječnoj cijeni", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 12, sistem: 10 }]);
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 12, cijena: 4 });
      expect((await knjiga(db))[0]).toMatchObject({ kolicina: 2, cijena: 4 });
    });
  });

  it("razlika nula ne knjiži ništa, ali popis ostaje zabilježen", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 10, sistem: 10 }]);
      expect(await knjiga(db)).toHaveLength(0);
      const [p] = await popisi(db);
      expect(p.stavke).toHaveLength(1);
    });
  });

  it("višak artikla bez cijene traži cijenu, a s cijenom pravi početno stanje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await db.query("savepoint a");
      await expect(potvrdi(db, [{ artikal_id: s.secer, brojano: 5 }])).rejects.toThrow(/cijen/i);
      await db.query("rollback to savepoint a");
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 5, cijena: 2.5 }], true);
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 5, cijena: 2.5 });
    });
  });

  it("višak s navedenom cijenom na postojeću zalihu daje ponderisanu prosječnu cijenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 20, sistem: 10, cijena: 6 }]);
      // 10 × 4 + 10 × 6 = 100 na 20 kg → 5
      expect(await stanje(db, s.secer)).toEqual({ kolicina: 20, cijena: 5 });
    });
  });

  it("manjak ignoriše navedenu cijenu i koristi prosječnu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10, cijena: 99 }]);
      expect((await knjiga(db))[0]).toMatchObject({ kolicina: -2, cijena: 4 });
      expect((await stanje(db, s.secer))?.cijena).toBe(4);
    });
  });

  it("artikal koji nije brojan ostaje netaknut", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 9, sistem: 10 }]);
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(20);
    });
  });

  it("više artikala odjednom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      await potvrdi(db, [
        { artikal_id: s.secer, brojano: 9, sistem: 10 },
        { artikal_id: s.mlijeko, brojano: 25, sistem: 20 },
      ]);
      expect((await stanje(db, s.secer))?.kolicina).toBe(9);
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(25);
      expect(await knjiga(db)).toHaveLength(2);
    });
  });

  it("stanje magacina odmah prikazuje usklađene količine", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 7, sistem: 10 }]);
      const { rows } = await db.query("select kolicina, vrijednost from magacin.stanje_magacina('prehrana') where naziv = 'Šećer'");
      expect(Number(rows[0].kolicina)).toBe(7);
      expect(Number(rows[0].vrijednost)).toBe(28);
    });
  });
});

describe("stanje se promijenilo između pregleda i potvrde", () => {
  it("potvrda se odbija i ništa se ne mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await naStanje(db, s, s.secer, 5, 4); // stiglo još 5 poslije pregleda
      await db.query("savepoint a");
      await expect(potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10 }])).rejects.toThrow(
        /promijenilo.*bilo 10.*sada 15/i,
      );
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.secer))?.kolicina).toBe(15);
      expect(await knjiga(db)).toHaveLength(0);
    });
  });

  it("bez navedenog sistemskog stanja potvrda koristi trenutno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 8 }]);
      expect((await stanje(db, s.secer))?.kolicina).toBe(8);
    });
  });
});

describe("popis se bilježi", () => {
  it("s imenom osobe, vremenom, razlikama i vrijednošću", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10 }]);
      await kao(db, s.sef);
      const [p] = await popisi(db);
      expect(p.ime).toBe("Amra");
      expect(p.pocetno).toBe(false);
      expect(Math.abs(Date.now() - new Date(p.vrijeme).getTime())).toBeLessThan(60_000);
      expect(p.stavke).toEqual([
        expect.objectContaining({ artikal: "Šećer", mjera: "kg", sistem: 10, brojano: 8, razlika: -2, vrijednost_razlike: -8 }),
      ]);
      expect(Number(p.vrijednost_razlike)).toBe(-8);
    });
  });

  it("može biti označen kao početno stanje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 5, cijena: 2 }], true);
      expect((await popisi(db))[0].pocetno).toBe(true);
    });
  });

  it("najnoviji popis je prvi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      const a = (await potvrdi(db, [{ artikal_id: s.secer, brojano: 9, sistem: 10 }])).rows[0].id;
      const b = (await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 9 }])).rows[0].id;
      expect((await popisi(db)).map((p) => p.id)).toEqual([b, a]);
    });
  });

  it("knjiga i zapisi popisa su nepromjenjivi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10 }]);
      await db.query("reset role");
      await db.query("savepoint a");
      await expect(db.query("update magacin.popis_stavka set brojano = 99")).rejects.toThrow(/nepromjenjiv/i);
      await db.query("rollback to savepoint a");
      await expect(db.query("delete from magacin.popis")).rejects.toThrow(/nepromjenjiv/i);
    });
  });

  it("razlika u knjizi upućuje na popis", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      const id = (await potvrdi(db, [{ artikal_id: s.secer, brojano: 8, sistem: 10 }])).rows[0].id;
      expect((await knjiga(db))[0].popis_id).toBe(id);
    });
  });
});

describe("neispravan popis", () => {
  it("prazan popis", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(potvrdi(db, [])).rejects.toThrow(/nijedan artikal/i);
    });
  });

  it("negativno brojano stanje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await expect(potvrdi(db, [{ artikal_id: s.secer, brojano: -1 }])).rejects.toThrow(/brojano/i);
    });
  });

  it("isti artikal dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await expect(
        potvrdi(db, [{ artikal_id: s.secer, brojano: 8 }, { artikal_id: s.secer, brojano: 9 }]),
      ).rejects.toThrow(/dvaput/i);
    });
  });

  it("nepoznat artikal", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(potvrdi(db, [{ artikal_id: "00000000-0000-4000-8000-000000000000", brojano: 1 }])).rejects.toThrow(/artikal/i);
    });
  });

  it("greška u jednoj stavci poništava cijeli popis", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await db.query("savepoint a");
      await expect(
        potvrdi(db, [
          { artikal_id: s.secer, brojano: 8, sistem: 10 },
          { artikal_id: s.mlijeko, brojano: 5 }, // višak bez cijene
        ]),
      ).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.secer))?.kolicina).toBe(10);
      expect(await popisi(db)).toHaveLength(0);
    });
  });
});

describe("ko smije popisivati", () => {
  it("menadžer smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10, 4);
      await kao(db, s.sef);
      await potvrdi(db, [{ artikal_id: s.secer, brojano: 9, sistem: 10 }]);
      expect((await stanje(db, s.secer))?.kolicina).toBe(9);
    });
  });

  it("objekat ne smije popisivati ni gledati popise magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(potvrdi(db, [{ artikal_id: s.secer, brojano: 1, cijena: 1 }])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await expect(pregled(db, [{ artikal_id: s.secer, brojano: 1 }])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await expect(popisi(db)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("neprijavljen ne smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijaviKaoNeprijavljen(db);
      await expect(potvrdi(db, [{ artikal_id: s.secer, brojano: 1, cijena: 1 }])).rejects.toThrow();
    });
  });
});
