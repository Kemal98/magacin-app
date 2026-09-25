import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKao, uTransakciji, type Uloga } from "./helpers";

async function kao(db: Client, uloga: Uloga) {
  const id = await napraviKorisnika(db, { ime: `Osoba ${uloga}`, uloga });
  await prijaviKao(db, id);
}

type Pakovanje = { id?: string; naziv: string; faktor: number; bar_kod?: string | null };

async function sacuvajArtikal(
  db: Client,
  a: {
    id?: string | null;
    naziv: string;
    mjera?: string;
    bar_kod?: string | null;
    minimum?: number;
    vrsta?: string;
    pakovanja?: Pakovanje[];
  },
): Promise<string> {
  const { rows } = await db.query(
    "select magacin.sacuvaj_artikal($1, $2, $3, $4, $5, $6, $7::jsonb) as id",
    [
      a.id ?? null,
      a.naziv,
      a.mjera ?? "kg",
      a.bar_kod ?? null,
      a.minimum ?? 0,
      a.vrsta ?? "prehrana",
      JSON.stringify(a.pakovanja ?? []),
    ],
  );
  return rows[0].id;
}

describe("artikli", () => {
  it("artikal ima jednu osnovnu mjeru i pakovanja s faktorom pretvaranja", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, {
        naziv: "Brašno",
        mjera: "kg",
        minimum: 20,
        pakovanja: [
          { naziv: "kutija", faktor: 10 },
          { naziv: "vreća", faktor: 25 },
        ],
      });
      const artikal = await db.query("select * from magacin.artikal where id = $1", [id]);
      expect(artikal.rows[0]).toMatchObject({
        naziv: "Brašno",
        mjera: "kg",
        vrsta: "prehrana",
        aktivan: true,
      });
      expect(Number(artikal.rows[0].minimum)).toBe(20);
      const pak = await db.query(
        "select naziv, faktor from magacin.pakovanje where artikal_id = $1 order by faktor",
        [id],
      );
      expect(pak.rows.map((r) => [r.naziv, Number(r.faktor)])).toEqual([
        ["kutija", 10],
        ["vreća", 25],
      ]);
    });
  });

  it("artikal može biti bez pakovanja", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, { naziv: "Jaja", mjera: "kom" });
      const pak = await db.query("select 1 from magacin.pakovanje where artikal_id = $1", [id]);
      expect(pak.rows).toHaveLength(0);
    });
  });

  it("izmjena artikla mijenja podatke i zamjenjuje pakovanja", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, {
        naziv: "Mlijeko",
        mjera: "l",
        pakovanja: [{ naziv: "gajba", faktor: 12 }],
      });
      const staro = await db.query("select id from magacin.pakovanje where artikal_id = $1", [id]);
      await sacuvajArtikal(db, {
        id,
        naziv: "Mlijeko 3,2%",
        mjera: "l",
        minimum: 5,
        pakovanja: [
          { id: staro.rows[0].id, naziv: "gajba", faktor: 6 },
          { naziv: "paleta", faktor: 600 },
        ],
      });
      const artikal = await db.query("select naziv, minimum from magacin.artikal where id = $1", [id]);
      expect(artikal.rows[0].naziv).toBe("Mlijeko 3,2%");
      expect(Number(artikal.rows[0].minimum)).toBe(5);
      const pak = await db.query(
        "select id, naziv, faktor from magacin.pakovanje where artikal_id = $1 order by faktor",
        [id],
      );
      expect(pak.rows.map((r) => [r.naziv, Number(r.faktor)])).toEqual([
        ["gajba", 6],
        ["paleta", 600],
      ]);
      expect(pak.rows[0].id).toBe(staro.rows[0].id);
    });
  });

  it("ukloni pakovanje koje nije poslano pri izmjeni", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, {
        naziv: "Šećer",
        pakovanja: [{ naziv: "kutija", faktor: 10 }],
      });
      await sacuvajArtikal(db, { id, naziv: "Šećer", pakovanja: [] });
      const pak = await db.query("select 1 from magacin.pakovanje where artikal_id = $1", [id]);
      expect(pak.rows).toHaveLength(0);
    });
  });

  it("artikal može pripadati materijalu", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, { naziv: "Deterdžent", mjera: "l", vrsta: "materijal" });
      const { rows } = await db.query("select vrsta from magacin.artikal where id = $1", [id]);
      expect(rows[0].vrsta).toBe("materijal");
    });
  });

  it("odbija nepoznatu mjeru", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(sacuvajArtikal(db, { naziv: "X", mjera: "metar" })).rejects.toThrow();
    });
  });

  it("odbija prazan naziv", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(sacuvajArtikal(db, { naziv: "   " })).rejects.toThrow(/naziv/i);
    });
  });

  it("odbija faktor pakovanja koji nije veći od nule", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(
        sacuvajArtikal(db, { naziv: "X", pakovanja: [{ naziv: "kutija", faktor: 0 }] }),
      ).rejects.toThrow(/faktor/i);
    });
  });

  it("odbija negativan minimum", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(sacuvajArtikal(db, { naziv: "X", minimum: -1 })).rejects.toThrow(/minimum/i);
    });
  });

  it("isključeni artikal ostaje u šifrarniku i može se ponovo uključiti", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, { naziv: "Kafa", mjera: "kg" });
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [id]);
      let { rows } = await db.query("select aktivan from magacin.artikal where id = $1", [id]);
      expect(rows[0].aktivan).toBe(false);
      await db.query("select magacin.postavi_aktivnost_artikla($1, true)", [id]);
      ({ rows } = await db.query("select aktivan from magacin.artikal where id = $1", [id]));
      expect(rows[0].aktivan).toBe(true);
    });
  });
});

describe("bar kod", () => {
  it("bar kod je jedinstven po artiklu", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await sacuvajArtikal(db, { naziv: "Kafa", bar_kod: "3850001" });
      await expect(sacuvajArtikal(db, { naziv: "Čaj", bar_kod: "3850001" })).rejects.toThrow(
        /bar kod/i,
      );
    });
  });

  it("artikal može zadržati svoj bar kod pri izmjeni", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const id = await sacuvajArtikal(db, { naziv: "Kafa", bar_kod: "3850001" });
      await sacuvajArtikal(db, { id, naziv: "Kafa espresso", bar_kod: "3850001" });
      const { rows } = await db.query("select naziv from magacin.artikal where bar_kod = '3850001'");
      expect(rows[0].naziv).toBe("Kafa espresso");
    });
  });

  it("više artikala može biti bez bar koda", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await sacuvajArtikal(db, { naziv: "Jabuke", bar_kod: "" });
      await sacuvajArtikal(db, { naziv: "Kruške", bar_kod: null });
      const { rows } = await db.query("select count(*)::int as n from magacin.artikal");
      expect(rows[0].n).toBe(2);
    });
  });

  it("pakovanje može imati vlastiti bar kod, jedinstven i prema artiklima", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await sacuvajArtikal(db, {
        naziv: "Kafa",
        bar_kod: "111",
        pakovanja: [{ naziv: "kutija", faktor: 10, bar_kod: "222" }],
      });
      await expect(
        sacuvajArtikal(db, {
          naziv: "Čaj",
          pakovanja: [{ naziv: "kutija", faktor: 5, bar_kod: "111" }],
        }),
      ).rejects.toThrow(/bar kod/i);
    });
  });

  it("bar kod pakovanja ne smije biti isti kao bar kod nekog artikla", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await sacuvajArtikal(db, {
        naziv: "Kafa",
        pakovanja: [{ naziv: "kutija", faktor: 10, bar_kod: "222" }],
      });
      await expect(sacuvajArtikal(db, { naziv: "Čaj", bar_kod: "222" })).rejects.toThrow(/bar kod/i);
    });
  });
});

describe("objekti i dobavljači", () => {
  it("objekat se dodaje, mijenja i isključuje", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const { rows } = await db.query("select magacin.sacuvaj_objekat(null, 'ŠANK HOTEL') as id");
      const id = rows[0].id;
      await db.query("select magacin.sacuvaj_objekat($1, 'ŠANK HOTEL CENTRAL')", [id]);
      await db.query("select magacin.postavi_aktivnost_objekta($1, false)", [id]);
      const o = await db.query("select naziv, aktivan from magacin.objekat where id = $1", [id]);
      expect(o.rows[0]).toEqual({ naziv: "ŠANK HOTEL CENTRAL", aktivan: false });
    });
  });

  it("dobavljač se dodaje, mijenja i isključuje", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      const { rows } = await db.query("select magacin.sacuvaj_dobavljaca(null, 'Mesnica Bosna') as id");
      const id = rows[0].id;
      await db.query("select magacin.sacuvaj_dobavljaca($1, 'Mesnica Bosna d.o.o.')", [id]);
      await db.query("select magacin.postavi_aktivnost_dobavljaca($1, false)", [id]);
      const d = await db.query("select naziv, aktivan from magacin.dobavljac where id = $1", [id]);
      expect(d.rows[0]).toEqual({ naziv: "Mesnica Bosna d.o.o.", aktivan: false });
    });
  });

  it("naziv objekta je jedinstven bez obzira na velika i mala slova", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await db.query("select magacin.sacuvaj_objekat(null, 'Kuhinja')");
      await expect(db.query("select magacin.sacuvaj_objekat(null, 'KUHINJA')")).rejects.toThrow(
        /već postoji/i,
      );
    });
  });

  it("naziv dobavljača je jedinstven bez obzira na velika i mala slova", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await db.query("select magacin.sacuvaj_dobavljaca(null, 'Pekara')");
      await expect(db.query("select magacin.sacuvaj_dobavljaca(null, 'pekara')")).rejects.toThrow(
        /već postoji/i,
      );
    });
  });

  it("odbija prazan naziv objekta i dobavljača", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await expect(db.query("select magacin.sacuvaj_objekat(null, ' ')")).rejects.toThrow(/naziv/i);
    });
  });
});

describe("ko smije mijenjati šifrarnik", () => {
  for (const uloga of ["magacioner", "objekat"] as const) {
    it(`${uloga} ne može mijenjati šifrarnik`, async () => {
      await uTransakciji(async (db) => {
        await kao(db, uloga);
        await expect(sacuvajArtikal(db, { naziv: "Kafa" })).rejects.toThrow(/nemate pravo/i);
      });
    });
  }

  it("magacioner ne može dodati objekat ni dobavljača", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "magacioner");
      await db.query("savepoint s");
      await expect(db.query("select magacin.sacuvaj_objekat(null, 'X')")).rejects.toThrow(
        /nemate pravo/i,
      );
      await db.query("rollback to savepoint s");
      await expect(db.query("select magacin.sacuvaj_dobavljaca(null, 'X')")).rejects.toThrow(
        /nemate pravo/i,
      );
    });
  });

  it("neprijavljen ne može mijenjati šifrarnik", async () => {
    await uTransakciji(async (db) => {
      await db.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      await db.query("set local role anon");
      await expect(sacuvajArtikal(db, { naziv: "Kafa" })).rejects.toThrow();
    });
  });

  it("magacioner i objekat mogu čitati šifrarnik, ali ne mogu pisati direktno u tabele", async () => {
    await uTransakciji(async (db) => {
      await kao(db, "menadzer");
      await sacuvajArtikal(db, { naziv: "Kafa" });
      await db.query("reset role");
      await kao(db, "magacioner");
      const { rows } = await db.query("select naziv from magacin.artikal");
      expect(rows.map((r) => r.naziv)).toEqual(["Kafa"]);
      await expect(
        db.query("insert into magacin.artikal (naziv, mjera, vrsta) values ('Hak', 'kg', 'prehrana')"),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });
});
