import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import { jedan, kao, odbij, odobri, posalji, pripremi, type Svijet } from "./svijet";

/** Magacioner primi robu; količina i cijena su u osnovnoj mjeri. */
async function naStanje(db: Client, s: Svijet, artikal: string, kolicina: number, cijena: number) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
}

async function izdaj(db: Client, zahtjev: string, stavke: { stavka_id: string; kolicina: number }[] | null = null) {
  await db.query("select magacin.izdaj_zahtjev($1, $2::jsonb)", [zahtjev, stavke ? JSON.stringify(stavke) : null]);
}

/** Objekat šalje, magacioner odobrava (puno) i vraća id zahtjeva. */
async function odobrenZahtjev(
  db: Client,
  s: Svijet,
  stavke: { artikal_id: string; pakovanje_id?: string | null; kolicina: number }[],
) {
  await kao(db, s.sankOsoblje);
  const id = await posalji(db, stavke);
  await kao(db, s.magacioner);
  await odobri(db, id);
  return id;
}

const stanje = async (db: Client, artikal: string) => {
  const { rows } = await db.query(
    "select kolicina, prosjecna_cijena from magacin.zaliha_magacina where artikal_id = $1",
    [artikal],
  );
  return rows[0] ? { kolicina: Number(rows[0].kolicina), cijena: Number(rows[0].prosjecna_cijena) } : undefined;
};

const zalihaObjekta = async (db: Client, objekat: string | null = null) => {
  const { rows } = await db.query("select * from magacin.zaliha_objekta($1)", [objekat]);
  return new Map(
    rows.map((r) => [
      r.naziv as string,
      {
        kolicina: Number(r.kolicina),
        cijena: r.prosjecna_cijena === null ? null : Number(r.prosjecna_cijena),
        vrijednost: r.vrijednost === null ? null : Number(r.vrijednost),
      },
    ]),
  );
};

describe("izdavanje: roba napušta magacin i ulazi u zalihu objekta", () => {
  it("skida zalihu magacina, povećava zalihu objekta i mijenja status u na dostavi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      expect((await jedan(db, id)).status).toBe("na_dostavi");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(15);
      expect((await zalihaObjekta(db, s.sank)).get("Topla čokolada")).toEqual({ kolicina: 5, cijena: 4, vrijednost: 20 });
    });
  });

  it("izdavanje u pakovanju skida osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.kafa, 100, 2);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.kafa, pakovanje_id: s.kutija, kolicina: 2 }]);
      await izdaj(db, id);
      expect((await stanje(db, s.kafa))?.kolicina).toBe(80);
      expect((await zalihaObjekta(db, s.sank)).get("Kafa")?.kolicina).toBe(20);
    });
  });

  it("izdaje se odobrena, a ne tražena količina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 10 }]);
      await kao(db, s.magacioner);
      const [st] = (await jedan(db, id)).stavke;
      await odobri(db, id, [{ stavka_id: st.id, kolicina: 6 }]);
      await izdaj(db, id);
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(14);
      expect((await zalihaObjekta(db, s.sank)).get("Topla čokolada")?.kolicina).toBe(6);
    });
  });

  it("može se izdati i manje od odobrenog (kad stanje između odobravanja i izdavanja padne)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 10 }]);
      const [st] = (await jedan(db, id)).stavke;
      await izdaj(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      const [nova] = (await jedan(db, id)).stavke;
      expect(Number(nova.izdana_kolicina)).toBe(3);
      expect(Number(nova.odobrena_kolicina)).toBe(10);
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(17);
    });
  });

  it("ne može se izdati više nego što je odobreno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await expect(izdaj(db, id, [{ stavka_id: st.id, kolicina: 6 }])).rejects.toThrow(/više nego što je odobreno/i);
    });
  });

  it("izdavanje bez ijedne količine se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await expect(izdaj(db, id, [{ stavka_id: st.id, kolicina: 0 }])).rejects.toThrow(/bar jednu/i);
    });
  });

  it("bilježi ime magacionera i vrijeme izdavanja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      const z = await jedan(db, id);
      expect(z.izdao).toBe("Amra");
      expect(Math.abs(Date.now() - new Date(z.izdano_vrijeme).getTime())).toBeLessThan(60_000);
    });
  });
});

describe("izdavanje iznad stanja se odbija", () => {
  it("javlja koji artikal i koliko ima na stanju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 4, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await expect(izdaj(db, id)).rejects.toThrow(/Topla čokolada.*na stanju 4.*potrebno 5/i);
    });
  });

  it("artikal koji nikad nije primljen ima stanje nula", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 1 }]);
      await expect(izdaj(db, id)).rejects.toThrow(/na stanju 0/i);
    });
  });

  it("nedostatak jedne stavke poništava izdavanje cijelog zahtjeva", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4); // dovoljno
      await naStanje(db, s, s.mlijeko, 1, 2); // premalo
      const id = await odobrenZahtjev(db, s, [
        { artikal_id: s.cokolada, kolicina: 5 },
        { artikal_id: s.mlijeko, kolicina: 3 },
      ]);
      await db.query("savepoint a");
      await expect(izdaj(db, id)).rejects.toThrow(/Mlijeko/);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(20);
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(1);
      expect((await zalihaObjekta(db, s.sank)).size).toBe(0);
      expect((await jedan(db, id)).status).toBe("odobren");
    });
  });

  it("stanje magacina nikad ne ode u minus", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 10, 4);
      const a = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 6 }]);
      const b = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 6 }]);
      await izdaj(db, a);
      await db.query("savepoint a");
      await expect(izdaj(db, b)).rejects.toThrow(/nema dovoljno/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(4);
    });
  });
});

describe("cijena izdatog", () => {
  it("zaliha objekta se vrednuje po prosječnoj cijeni magacina u trenutku izdavanja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 10, 2);
      await naStanje(db, s, s.cokolada, 10, 4); // prosjek 3
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 8 }]);
      await izdaj(db, id);
      expect((await zalihaObjekta(db, s.sank)).get("Topla čokolada")).toEqual({ kolicina: 8, cijena: 3, vrijednost: 24 });
    });
  });

  it("izdavanje ne mijenja prosječnu cijenu magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 10, 2);
      await naStanje(db, s, s.cokolada, 10, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 8 }]);
      await izdaj(db, id);
      expect(await stanje(db, s.cokolada)).toEqual({ kolicina: 12, cijena: 3 });
    });
  });

  it("dva izdavanja po različitim cijenama daju ponderisanu cijenu zalihe objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 10, 2);
      const prvi = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 10 }]);
      await izdaj(db, prvi); // 10 kom po 2
      await naStanje(db, s, s.cokolada, 10, 4); // magacin sada prosjek 4
      const drugi = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 10 }]);
      await izdaj(db, drugi); // 10 kom po 4
      expect((await zalihaObjekta(db, s.sank)).get("Topla čokolada")).toEqual({ kolicina: 20, cijena: 3, vrijednost: 60 });
    });
  });

  it("izdavanje ne stvara trošak: roba je u zalihi objekta, a ne potrošena", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      const { rows } = await db.query(
        "select vrsta, kolicina from magacin.kretanje_objekta where objekat_id = $1",
        [s.sank],
      );
      expect(rows).toEqual([{ vrsta: "izdavanje", kolicina: "5" }]);
      const { rows: potrosnja } = await db.query(
        "select count(*)::int as n from magacin.kretanje_objekta where vrsta <> 'izdavanje'",
      );
      expect(potrosnja[0].n).toBe(0);
    });
  });
});

describe("knjige kretanja", () => {
  it("izdavanje se bilježi u knjizi magacina (izlaz) i knjizi objekta (ulaz), s imenom i zahtjevom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      const { rows: magacin } = await db.query(
        "select vrsta, kolicina, cijena, korisnik_id, zahtjev_id, objekat_id from magacin.kretanje_magacina where vrsta = 'izdavanje'",
      );
      expect(magacin).toHaveLength(1);
      expect(magacin[0]).toMatchObject({ vrsta: "izdavanje", korisnik_id: s.magacioner, zahtjev_id: id, objekat_id: s.sank });
      expect(Number(magacin[0].kolicina)).toBe(-5);
      expect(Number(magacin[0].cijena)).toBe(4);
      const { rows: objekat } = await db.query(
        "select kolicina, cijena, korisnik_id, zahtjev_id from magacin.kretanje_objekta",
      );
      expect(objekat).toHaveLength(1);
      expect(Number(objekat[0].kolicina)).toBe(5);
      expect(Number(objekat[0].cijena)).toBe(4);
      expect(objekat[0]).toMatchObject({ korisnik_id: s.magacioner, zahtjev_id: id });
    });
  });

  it("knjiga objekta je nepromjenjiva", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await db.query("reset role");
      await db.query("savepoint a");
      await expect(db.query("update magacin.kretanje_objekta set kolicina = 99")).rejects.toThrow(/nepromjenjiv/i);
      await db.query("rollback to savepoint a");
      await expect(db.query("delete from magacin.kretanje_objekta")).rejects.toThrow(/nepromjenjiv/i);
    });
  });
});

describe("zabranjeni prelazi", () => {
  it("poslan zahtjev se ne može izdati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await expect(izdaj(db, id)).rejects.toThrow(/nije odobren/i);
    });
  });

  it("odbijen zahtjev se ne može izdati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odbij(db, id, "Ne treba");
      await expect(izdaj(db, id)).rejects.toThrow(/nije odobren/i);
    });
  });

  it("zahtjev se ne može izdati dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await db.query("savepoint a");
      await expect(izdaj(db, id)).rejects.toThrow(/nije odobren|već izdat/i);
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.cokolada))?.kolicina).toBe(15);
    });
  });

  it("izdati zahtjev se ne može ni odobriti ni odbiti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await db.query("savepoint a");
      await expect(odobri(db, id)).rejects.toThrow(/već obrađen/i);
      await db.query("rollback to savepoint a");
      await expect(odbij(db, id, "Kasno")).rejects.toThrow(/već obrađen/i);
    });
  });

  it("nepostojeći zahtjev se ne može izdati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(izdaj(db, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/zahtjev/i);
    });
  });

  it("objekat ne može izdati robu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.sankOsoblje);
      await expect(izdaj(db, id)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("menadžer može izdati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.sef);
      await izdaj(db, id);
      expect((await jedan(db, id)).status).toBe("na_dostavi");
    });
  });

  it("neprijavljen ne može izdati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await expect(izdaj(db, id)).rejects.toThrow();
    });
  });
});

describe("šta objekat vidi nakon izdavanja", () => {
  it("objekat vidi status na dostavi i izdane količine, ali ne stanje magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await kao(db, s.sankOsoblje);
      const z = await jedan(db, id);
      expect(z.status).toBe("na_dostavi");
      expect(z.izdao).toBe("Amra");
      expect(Number(z.stavke[0].izdana_kolicina)).toBe(5);
      expect(z.stavke[0].na_stanju).toBeNull();
    });
  });

  it("objekat vidi svoju zalihu bez cijena, a tuđu ne", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await kao(db, s.sankOsoblje);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toEqual({ kolicina: 5, cijena: null, vrijednost: null });
      await db.query("savepoint a");
      await expect(zalihaObjekta(db, s.kuhinja)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.kuhinjaOsoblje);
      expect((await zalihaObjekta(db)).size).toBe(0);
    });
  });

  it("magacioner i menadžer vide zalihu objekta s cijenama", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await odobrenZahtjev(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await izdaj(db, id);
      await kao(db, s.sef);
      expect((await zalihaObjekta(db, s.sank)).get("Topla čokolada")).toEqual({ kolicina: 5, cijena: 4, vrijednost: 20 });
    });
  });

  it("zaliha objekta se ne može mijenjati direktno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(
        db.query("insert into magacin.zaliha_objekta (objekat_id, artikal_id, kolicina, prosjecna_cijena) values ($1, $2, 100, 1)", [s.sank, s.cokolada]),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });
});
