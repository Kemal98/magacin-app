import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKao, uTransakciji } from "./helpers";

type Svijet = { sank: string; kuhinja: string; kafa: string; cokolada: string; brasno: string; mlijeko: string };

/** Menadžer postavlja šifrarnik; vraća se u ulogu vlasnika baze. */
async function pripremi(db: Client): Promise<Svijet> {
  const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
  await prijaviKao(db, sef);
  const artikal = async (naziv: string, mjera: string, pak: unknown[] = []) =>
    (
      await db.query("select magacin.sacuvaj_artikal(null, $1, $2, '', 0, 'prehrana', $3::jsonb) as id", [
        naziv,
        mjera,
        JSON.stringify(pak),
      ])
    ).rows[0].id as string;
  const objekat = async (naziv: string) =>
    (await db.query("select magacin.sacuvaj_objekat(null, $1) as id", [naziv])).rows[0].id as string;
  const s = {
    sank: await objekat("ŠANK HOTEL"),
    kuhinja: await objekat("KUHINJA"),
    kafa: await artikal("Kafa", "kg", [{ naziv: "kutija", faktor: 10, bar_kod: "111" }]),
    cokolada: await artikal("Topla čokolada", "kg"),
    brasno: await artikal("Brašno", "kg"),
    mlijeko: await artikal("Mlijeko", "l"),
  };
  await db.query("reset role");
  return s;
}

async function postavi(db: Client, objekat: string, artikli: string[]) {
  await db.query("select magacin.postavi_artikle_objekta($1, $2::uuid[])", [objekat, artikli]);
}

async function popis(db: Client, objekat: string | null = null) {
  const { rows } = await db.query("select * from magacin.artikli_objekta($1)", [objekat]);
  return rows;
}

const nazivi = (rows: { naziv: string }[]) => rows.map((r) => r.naziv).sort();

describe("menadžer zadaje popis artikala objekta", () => {
  it("postavlja popis, a objekat vidi samo te artikle", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa, s.cokolada]);
      await db.query("reset role");

      const osoblje = await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat", objekatId: s.sank });
      await prijaviKao(db, osoblje);
      expect(nazivi(await popis(db))).toEqual(["Kafa", "Topla čokolada"]);
    });
  });

  it("može dodati i ukloniti artikle na popisu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa, s.cokolada]);
      await postavi(db, s.sank, [s.cokolada, s.mlijeko]); // kafa uklonjena, mlijeko dodano
      expect(nazivi(await popis(db, s.sank))).toEqual(["Mlijeko", "Topla čokolada"]);
      await postavi(db, s.sank, []);
      expect(await popis(db, s.sank)).toHaveLength(0);
    });
  });

  it("isti artikal dvaput u nizu ulazi jednom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa, s.kafa]);
      expect(await popis(db, s.sank)).toHaveLength(1);
    });
  });

  it("popis jednog objekta ne dira popis drugog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa]);
      await postavi(db, s.kuhinja, [s.brasno]);
      await postavi(db, s.sank, []);
      expect(nazivi(await popis(db, s.kuhinja))).toEqual(["Brašno"]);
    });
  });

  it("nepoznat artikal ili objekat se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await db.query("savepoint a");
      await expect(postavi(db, s.sank, [s.kafa, "00000000-0000-4000-8000-000000000000"])).rejects.toThrow(/artikal/i);
      await db.query("rollback to savepoint a");
      await expect(postavi(db, "00000000-0000-4000-8000-000000000000", [s.kafa])).rejects.toThrow(/objekat/i);
    });
  });
});

describe("šta objekat vidi", () => {
  it("objekat ne vidi artikle drugog objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa]);
      await postavi(db, s.kuhinja, [s.brasno]);
      await db.query("reset role");
      const osoblje = await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat", objekatId: s.sank });
      await prijaviKao(db, osoblje);
      expect(nazivi(await popis(db))).toEqual(["Kafa"]);
      const { rows } = await db.query("select artikal_id, objekat_id from magacin.objekat_artikal");
      expect(rows.every((r) => r.objekat_id === s.sank)).toBe(true);
    });
  });

  it("objekat ne može tražiti popis drugog objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const osoblje = await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat", objekatId: s.sank });
      await prijaviKao(db, osoblje);
      await expect(popis(db, s.kuhinja)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("isključen artikal nestaje s popisa objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa, s.cokolada]);
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [s.cokolada]);
      expect(nazivi(await popis(db, s.sank))).toEqual(["Kafa"]);
    });
  });

  it("popis nosi mjeru, bar kod i pakovanja za unos", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa]);
      const [kafa] = await popis(db, s.sank);
      expect(kafa).toMatchObject({ naziv: "Kafa", mjera: "kg", vrsta: "prehrana" });
      expect(kafa.pakovanja).toEqual([expect.objectContaining({ naziv: "kutija", faktor: 10, bar_kod: "111" })]);
    });
  });

  it("objekat koji nije vezan za objekat dobija jasnu grešku", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      const osoblje = await napraviKorisnika(db, { ime: "Bez objekta", uloga: "objekat" });
      await prijaviKao(db, osoblje);
      await expect(popis(db)).rejects.toThrow(/nije vezan/i);
    });
  });

  it("menadžer i magacioner moraju navesti objekat", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await expect(popis(db)).rejects.toThrow(/objekat/i);
    });
  });

  it("magacioner vidi popis objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const sef = await napraviKorisnika(db, { ime: "Šef2", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await postavi(db, s.sank, [s.kafa]);
      await db.query("reset role");
      const mag = await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      await prijaviKao(db, mag);
      expect(nazivi(await popis(db, s.sank))).toEqual(["Kafa"]);
    });
  });
});

describe("ko smije mijenjati popis", () => {
  for (const uloga of ["magacioner", "objekat"] as const) {
    it(`${uloga} ne smije`, async () => {
      await uTransakciji(async (db) => {
        const s = await pripremi(db);
        const id = await napraviKorisnika(db, { ime: "X", uloga, objekatId: uloga === "objekat" ? s.sank : null });
        await prijaviKao(db, id);
        await expect(postavi(db, s.sank, [s.kafa])).rejects.toThrow(/nemate pravo/i);
      });
    });
  }

  it("objekat ne može direktno pisati u tabelu popisa", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const osoblje = await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat", objekatId: s.sank });
      await prijaviKao(db, osoblje);
      await expect(
        db.query("insert into magacin.objekat_artikal (objekat_id, artikal_id) values ($1, $2)", [s.sank, s.kafa]),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });
});
