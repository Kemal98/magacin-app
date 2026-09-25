import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import { kao, pripremi, type Svijet } from "./svijet";

async function naStanje(db: Client, s: Svijet, artikal: string, kolicina: number, cijena = 2) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
}

const postavi = (db: Client, artikal: string, minimum: number) =>
  db.query("select magacin.postavi_minimum($1, $2)", [artikal, minimum]);

const stanje = async (db: Client, vrsta = "prehrana") =>
  new Map(
    (await db.query("select * from magacin.stanje_magacina($1)", [vrsta])).rows.map((r) => [
      r.naziv as string,
      { minimum: Number(r.minimum), ispod: r.ispod_minimuma as boolean, kolicina: Number(r.kolicina) },
    ]),
  );

const zaNaruciti = async (db: Client, vrsta: string | null = null) =>
  (await db.query("select * from magacin.artikli_ispod_minimuma($1)", [vrsta])).rows;

describe("zadavanje minimuma", () => {
  it("magacioner zadaje i mijenja minimum po artiklu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await postavi(db, s.secer, 20);
      expect((await stanje(db)).get("Šećer")?.minimum).toBe(20);
      await postavi(db, s.secer, 35.5);
      expect((await stanje(db)).get("Šećer")?.minimum).toBe(35.5);
    });
  });

  it("menadžer također može", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.secer, 10);
      expect((await stanje(db)).get("Šećer")?.minimum).toBe(10);
    });
  });

  it("minimum zadan u šifrarniku vidi se u stanju magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await db.query("select magacin.sacuvaj_artikal($1, 'Šećer', 'kg', '', 12, 'prehrana', '[]'::jsonb)", [s.secer]);
      expect((await stanje(db)).get("Šećer")?.minimum).toBe(12);
    });
  });

  it("negativan minimum se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(postavi(db, s.secer, -1)).rejects.toThrow(/minimum/i);
    });
  });

  it("nepoznat artikal se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(postavi(db, "00000000-0000-4000-8000-000000000000", 5)).rejects.toThrow(/artikal/i);
    });
  });

  it("objekat i neprijavljen ne mogu mijenjati minimum", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(postavi(db, s.secer, 5)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await prijaviKaoNeprijavljen(db);
      await expect(postavi(db, s.secer, 5)).rejects.toThrow();
    });
  });
});

describe("artikal ispod minimuma", () => {
  it("je označen kad zaliha padne ispod minimuma", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 8);
      await postavi(db, s.secer, 10);
      expect((await stanje(db)).get("Šećer")).toMatchObject({ kolicina: 8, minimum: 10, ispod: true });
    });
  });

  it("nije označen kad je zaliha jednaka minimumu ili veća", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 10);
      await naStanje(db, s, s.mlijeko, 30);
      await postavi(db, s.secer, 10);
      await postavi(db, s.mlijeko, 10);
      const st = await stanje(db);
      expect(st.get("Šećer")?.ispod).toBe(false);
      expect(st.get("Mlijeko")?.ispod).toBe(false);
    });
  });

  it("bez zadanog minimuma (nula) nikad nije označen, ni kad je zaliha nula", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      expect((await stanje(db)).get("Šećer")).toMatchObject({ kolicina: 0, minimum: 0, ispod: false });
    });
  });

  it("artikal bez zalihe, a s minimumom, je ispod minimuma", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await postavi(db, s.secer, 5);
      expect((await stanje(db)).get("Šećer")?.ispod).toBe(true);
    });
  });

  it("nakon prijema koji podigne zalihu upozorenje nestaje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 3);
      await postavi(db, s.secer, 10);
      expect((await stanje(db)).get("Šećer")?.ispod).toBe(true);
      await naStanje(db, s, s.secer, 10);
      expect((await stanje(db)).get("Šećer")?.ispod).toBe(false);
    });
  });

  it("otpis koji spusti zalihu ispod minimuma pali upozorenje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 12);
      await postavi(db, s.secer, 10);
      expect((await stanje(db)).get("Šećer")?.ispod).toBe(false);
      await db.query("select magacin.otpisi_iz_magacina($1, 5, 'Isteklo')", [s.secer]);
      expect((await stanje(db)).get("Šećer")?.ispod).toBe(true);
    });
  });
});

describe("popis artikala za naručivanje", () => {
  it("sadrži samo artikle ispod minimuma, s količinom koja nedostaje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 3);
      await naStanje(db, s, s.mlijeko, 50);
      await postavi(db, s.secer, 10);
      await postavi(db, s.mlijeko, 20);
      const r = await zaNaruciti(db);
      expect(r.map((x) => x.naziv)).toEqual(["Šećer"]);
      expect(Number(r[0].kolicina)).toBe(3);
      expect(Number(r[0].minimum)).toBe(10);
      expect(Number(r[0].nedostaje)).toBe(7);
      expect(r[0].mjera).toBe("kg");
    });
  });

  it("najprazniji artikli su prvi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.secer, 9); // 90 % minimuma
      await naStanje(db, s, s.mlijeko, 2); // 10 % minimuma
      await postavi(db, s.secer, 10);
      await postavi(db, s.mlijeko, 20);
      await postavi(db, s.brasno, 5); // bez zalihe: 0 %
      expect((await zaNaruciti(db)).map((x) => x.naziv)).toEqual(["Brašno", "Mlijeko", "Šećer"]);
    });
  });

  it("može se suziti na magacin prehrane ili materijala", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      const { rows } = await db.query(
        "select magacin.sacuvaj_artikal(null, 'Deterdžent', 'l', '', 0, 'materijal', '[]'::jsonb) as id",
      );
      await kao(db, s.magacioner);
      await postavi(db, s.secer, 5);
      await postavi(db, rows[0].id, 5);
      expect((await zaNaruciti(db, "prehrana")).map((x) => x.naziv)).toEqual(["Šećer"]);
      expect((await zaNaruciti(db, "materijal")).map((x) => x.naziv)).toEqual(["Deterdžent"]);
      expect(await zaNaruciti(db)).toHaveLength(2);
    });
  });

  it("isključeni artikal se ne nudi za naručivanje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await postavi(db, s.secer, 5);
      await kao(db, s.sef);
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [s.secer]);
      expect(await zaNaruciti(db)).toHaveLength(0);
    });
  });

  it("vide ga magacioner i menadžer, ali ne objekat", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await postavi(db, s.secer, 5);
      await kao(db, s.sef);
      expect(await zaNaruciti(db)).toHaveLength(1);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(zaNaruciti(db)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await expect(stanje(db)).rejects.toThrow(/nemate pravo/i);
    });
  });
});
