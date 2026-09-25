import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKao, uTransakciji, type Uloga } from "./helpers";

async function kao(db: Client, uloga: Uloga) {
  const id = await napraviKorisnika(db, { ime: `Osoba ${uloga}`, uloga });
  await prijaviKao(db, id);
}

const ARTIKLI = [
  { naziv: "Brašno", mjera: "kg", vrsta: "prehrana" },
  { naziv: "Ajax za pod 1l", mjera: "kom", vrsta: "materijal" },
];

async function uvezi(
  db: Client,
  artikli: unknown[] = ARTIKLI,
  objekti: string[] = ["KUHINJA", "ŠANK HOTEL"],
  dobavljaci: string[] = ["Pekara d.o.o"],
) {
  const { rows } = await db.query(
    "select magacin.uvezi_sifrarnik($1::jsonb, $2::jsonb, $3::jsonb) as rezultat",
    [JSON.stringify(artikli), JSON.stringify(objekti), JSON.stringify(dobavljaci)],
  );
  return rows[0].rezultat;
}

const brojevi = async (db: Client) => {
  const { rows } = await db.query(`select
    (select count(*)::int from magacin.artikal) as artikli,
    (select count(*)::int from magacin.objekat) as objekti,
    (select count(*)::int from magacin.dobavljac) as dobavljaci`);
  return rows[0];
};

describe("uvoz šifrarnika", () => {
  it("uvozi artikle, objekte i dobavljače i javlja koliko je novih", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const rezultat = await uvezi(db);
      expect(rezultat).toEqual({ artikli: 2, objekti: 2, dobavljaci: 1 });
      expect(await brojevi(db)).toEqual({ artikli: 2, objekti: 2, dobavljaci: 1 });
      const { rows } = await db.query(
        "select naziv, mjera, vrsta, aktivan, bar_kod, minimum from magacin.artikal order by naziv",
      );
      expect(rows[0]).toMatchObject({ naziv: "Ajax za pod 1l", mjera: "kom", vrsta: "materijal", aktivan: true, bar_kod: null });
      expect(Number(rows[0].minimum)).toBe(0);
    });
  });

  it("ponovni uvoz ne pravi duplikate", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await uvezi(db);
      const drugi = await uvezi(db, ARTIKLI, ["kuhinja", "ŠANK HOTEL"], ["PEKARA D.O.O"]);
      expect(drugi).toEqual({ artikli: 0, objekti: 0, dobavljaci: 0 });
      expect(await brojevi(db)).toEqual({ artikli: 2, objekti: 2, dobavljaci: 1 });
    });
  });

  it("postojeći artikal se ne mijenja ponovnim uvozom (menadžerove izmjene ostaju)", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await uvezi(db);
      const { rows: r } = await db.query(
        "select id from magacin.artikal where naziv = 'Ajax za pod 1l'",
      );
      await db.query(
        "select magacin.sacuvaj_artikal($1, 'Ajax za pod 1l', 'kom', null, 7, 'prehrana', '[]'::jsonb)",
        [r[0].id],
      );
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [r[0].id]);
      await uvezi(db);
      const { rows } = await db.query(
        "select vrsta, minimum, aktivan from magacin.artikal where naziv = 'Ajax za pod 1l'",
      );
      expect(rows[0]).toMatchObject({ vrsta: "prehrana", aktivan: false });
      expect(Number(rows[0].minimum)).toBe(7);
    });
  });

  it("novi artikli se dodaju uz postojeće", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await uvezi(db);
      const rezultat = await uvezi(db, [...ARTIKLI, { naziv: "Šećer", mjera: "kg", vrsta: "prehrana" }]);
      expect(rezultat.artikli).toBe(1);
      expect((await brojevi(db)).artikli).toBe(3);
    });
  });

  it("isti naziv dvaput u jednom uvozu ulazi jednom", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const rezultat = await uvezi(
        db,
        [ARTIKLI[0], { naziv: "  brašno ", mjera: "kg", vrsta: "prehrana" }],
        ["KUHINJA", "Kuhinja"],
        [],
      );
      expect(rezultat).toEqual({ artikli: 1, objekti: 1, dobavljaci: 0 });
    });
  });

  it("neispravna mjera prekida cijeli uvoz", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(
        uvezi(db, [ARTIKLI[0], { naziv: "Metar", mjera: "metar", vrsta: "prehrana" }]),
      ).rejects.toThrow();
    });
  });

  it("odbija prazan naziv artikla", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(uvezi(db, [{ naziv: " ", mjera: "kg", vrsta: "prehrana" }])).rejects.toThrow(/naziv/i);
    });
  });

  for (const uloga of ["magacioner", "objekat"] as const) {
    it(`${uloga} ne može uvoziti`, async () => {
      await uTransakciji(async (db) => {
        await kao(db, uloga);
        await expect(uvezi(db)).rejects.toThrow(/nemate pravo/i);
      });
    });
  }
});
