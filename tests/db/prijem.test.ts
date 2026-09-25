import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  napraviKorisnika,
  prijaviKao,
  prijaviKaoNeprijavljen,
  uTransakciji,
  type Uloga,
} from "./helpers";

async function kao(db: Client, uloga: Uloga, ime = `Osoba ${uloga}`) {
  const id = await napraviKorisnika(db, { ime, uloga });
  await prijaviKao(db, id);
  return id;
}

/** Priprema šifrarnik kao menadžer, pa se prebacuje na traženu ulogu. */
async function pripremi(db: Client) {
  await kao(db, "menadzer", "Šef");
  const artikal = async (naziv: string, mjera = "kg", pakovanja: unknown[] = [], vrsta = "prehrana") => {
    const { rows } = await db.query(
      "select magacin.sacuvaj_artikal(null, $1, $2, null, 0, $3, $4::jsonb) as id",
      [naziv, mjera, vrsta, JSON.stringify(pakovanja)],
    );
    return rows[0].id as string;
  };
  const brasno = await artikal("Brašno", "kg", [{ naziv: "kutija", faktor: 10 }]);
  const secer = await artikal("Šećer", "kg");
  const mlijeko = await artikal("Mlijeko", "l");
  const deterdzent = await artikal("Deterdžent", "l", [], "materijal");
  const { rows: d } = await db.query("select magacin.sacuvaj_dobavljaca(null, 'Pekara') as id");
  const { rows: p } = await db.query("select id from magacin.pakovanje where artikal_id = $1", [brasno]);
  await db.query("reset role");
  return { brasno, secer, mlijeko, deterdzent, dobavljac: d[0].id as string, kutija: p[0].id as string };
}

type Stavka = { artikal_id: string; pakovanje_id?: string | null; kolicina: number; cijena: number };

async function prijem(db: Client, dobavljac: string, stavke: Stavka[]): Promise<string> {
  const { rows } = await db.query("select magacin.unesi_prijem($1, $2::jsonb) as id", [
    dobavljac,
    JSON.stringify(stavke),
  ]);
  return rows[0].id;
}

async function stanje(db: Client, vrsta = "prehrana") {
  const { rows } = await db.query("select * from magacin.stanje_magacina($1)", [vrsta]);
  return new Map(
    rows.map((r) => [
      r.naziv as string,
      {
        kolicina: Number(r.kolicina),
        cijena: Number(r.prosjecna_cijena),
        vrijednost: Number(r.vrijednost),
        mjera: r.mjera as string,
      },
    ]),
  );
}

describe("prijem robe", () => {
  it("prijem povećava stanje i vrijednost artikla", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 50, cijena: 2 }]);
      expect((await stanje(db)).get("Šećer")).toEqual({ kolicina: 50, cijena: 2, vrijednost: 100, mjera: "kg" });
    });
  });

  it("pakovanje se pretvara u osnovnu mjeru, a cijena se svodi na osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      // 3 kutije po 10 kg, 45 KM po kutiji = 30 kg po 4,50 KM/kg
      await prijem(db, s.dobavljac, [
        { artikal_id: s.brasno, pakovanje_id: s.kutija, kolicina: 3, cijena: 45 },
      ]);
      expect((await stanje(db)).get("Brašno")).toEqual({ kolicina: 30, cijena: 4.5, vrijednost: 135, mjera: "kg" });
    });
  });

  it("prosječna cijena je ponderisana i mijenja se prijemom po drugoj cijeni", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 30, cijena: 4 }]);
      // (10*2 + 30*4) / 40 = 3,50
      expect((await stanje(db)).get("Šećer")).toEqual({ kolicina: 40, cijena: 3.5, vrijednost: 140, mjera: "kg" });
    });
  });

  it("tri prijema po različitim cijenama daju tačnu prosječnu cijenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.mlijeko, kolicina: 100, cijena: 1.5 }]);
      await prijem(db, s.dobavljac, [{ artikal_id: s.mlijeko, kolicina: 100, cijena: 1.7 }]);
      await prijem(db, s.dobavljac, [{ artikal_id: s.mlijeko, kolicina: 200, cijena: 1.6 }]);
      const m = (await stanje(db)).get("Mlijeko")!;
      expect(m.kolicina).toBe(400);
      expect(m.cijena).toBeCloseTo(1.6, 10);
      expect(m.vrijednost).toBeCloseTo(640, 8);
    });
  });

  it("prijem u pakovanju i u osnovnoj mjeri se miješaju u istu prosječnu cijenu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [
        { artikal_id: s.brasno, pakovanje_id: s.kutija, kolicina: 1, cijena: 20 }, // 10 kg po 2
        { artikal_id: s.brasno, kolicina: 10, cijena: 4 }, // 10 kg po 4
      ]);
      expect((await stanje(db)).get("Brašno")).toEqual({ kolicina: 20, cijena: 3, vrijednost: 60, mjera: "kg" });
    });
  });

  it("jedan prijem s više artikala ažurira svaki artikal", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [
        { artikal_id: s.secer, kolicina: 5, cijena: 2 },
        { artikal_id: s.mlijeko, kolicina: 20, cijena: 1.5 },
      ]);
      const st = await stanje(db);
      expect(st.get("Šećer")?.vrijednost).toBe(10);
      expect(st.get("Mlijeko")?.vrijednost).toBe(30);
    });
  });

  it("isti artikal dvaput u jednom prijemu se sabira", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [
        { artikal_id: s.secer, kolicina: 10, cijena: 2 },
        { artikal_id: s.secer, kolicina: 10, cijena: 4 },
      ]);
      expect((await stanje(db)).get("Šećer")).toEqual({ kolicina: 20, cijena: 3, vrijednost: 60, mjera: "kg" });
    });
  });
});

describe("pregled stanja", () => {
  it("pokazuje samo artikle traženog magacina, i one bez zalihe", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 5, cijena: 2 }]);
      const prehrana = await stanje(db, "prehrana");
      expect([...prehrana.keys()].sort()).toEqual(["Brašno", "Mlijeko", "Šećer"]);
      expect(prehrana.get("Brašno")).toMatchObject({ kolicina: 0, vrijednost: 0 });
      expect([...(await stanje(db, "materijal")).keys()]).toEqual(["Deterdžent"]);
    });
  });

  it("isključeni artikal se ne pojavljuje u pregledu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "menadzer", "Šef2");
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [s.mlijeko]);
      expect((await stanje(db)).has("Mlijeko")).toBe(false);
    });
  });

  it("menadžer vidi stanje", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      await kao(db, "menadzer", "Šef2");
      expect((await stanje(db)).size).toBe(3);
    });
  });

  it("objekat ne vidi stanje ni cijene magacina", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      await kao(db, "objekat");
      await expect(db.query("select * from magacin.stanje_magacina('prehrana')")).rejects.toThrow(
        /nemate pravo/i,
      );
    });
  });
});

describe("knjiga kretanja", () => {
  it("prijem se bilježi s imenom osobe, vremenom, dobavljačem i količinom u osnovnoj mjeri", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const amra = await kao(db, "magacioner", "Amra");
      const prijemId = await prijem(db, s.dobavljac, [
        { artikal_id: s.brasno, pakovanje_id: s.kutija, kolicina: 3, cijena: 45 },
      ]);
      const { rows } = await db.query(
        `select k.*, ko.ime, p.dobavljac_id, p.korisnik_id as prijem_korisnik
         from magacin.kretanje_magacina k
         join magacin.korisnik ko on ko.id = k.korisnik_id
         join magacin.prijem p on p.id = k.prijem_id`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        vrsta: "prijem",
        artikal_id: s.brasno,
        korisnik_id: amra,
        ime: "Amra",
        prijem_id: prijemId,
        dobavljac_id: s.dobavljac,
        prijem_korisnik: amra,
        pakovanje_id: s.kutija,
      });
      expect(Number(rows[0].kolicina)).toBe(30);
      expect(Number(rows[0].cijena)).toBe(4.5);
      expect(Number(rows[0].kolicina_pakovanja)).toBe(3);
      expect(Math.abs(Date.now() - new Date(rows[0].vrijeme).getTime())).toBeLessThan(60_000);
    });
  });

  it("zapisi u knjizi se ne mogu mijenjati ni brisati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 5, cijena: 2 }]);
      await db.query("reset role");
      await db.query("savepoint a");
      await expect(db.query("update magacin.kretanje_magacina set kolicina = 999")).rejects.toThrow(
        /nepromjenjiv/i,
      );
      await db.query("rollback to savepoint a");
      await expect(db.query("delete from magacin.kretanje_magacina")).rejects.toThrow(/nepromjenjiv/i);
    });
  });

  it("zaglavlje prijema se ne može mijenjati ni brisati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 5, cijena: 2 }]);
      await db.query("reset role");
      await expect(db.query("delete from magacin.prijem")).rejects.toThrow(/nepromjenjiv/i);
    });
  });

  it("magacioner ne može direktno pisati u knjigu ni u stanje", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await db.query("savepoint a");
      await expect(
        db.query("insert into magacin.zaliha_magacina (artikal_id, kolicina, prosjecna_cijena) values ($1, 5, 1)", [s.secer]),
      ).rejects.toThrow(/permission denied|row-level security/i);
      await db.query("rollback to savepoint a");
      await expect(db.query("delete from magacin.kretanje_magacina")).rejects.toThrow(
        /permission denied|row-level security/i,
      );
    });
  });

  it("objekat ne može čitati knjigu magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 5, cijena: 2 }]);
      await db.query("reset role");
      await kao(db, "objekat");
      const { rows } = await db.query("select * from magacin.kretanje_magacina");
      expect(rows).toHaveLength(0);
    });
  });
});

describe("zadnji prijemi", () => {
  it("pokazuje ko je, kada i od koga primio robu, najnoviji prvi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner", "Amra");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 10, cijena: 2 }]);
      await prijem(db, s.dobavljac, [
        { artikal_id: s.secer, kolicina: 5, cijena: 2 },
        { artikal_id: s.mlijeko, pakovanje_id: null, kolicina: 10, cijena: 1 },
      ]);
      const { rows } = await db.query("select * from magacin.zadnji_prijemi(10)");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ ime: "Amra", dobavljac: "Pekara", broj_stavki: 2 });
      expect(Number(rows[0].vrijednost)).toBe(20);
      expect(rows[1]).toMatchObject({ broj_stavki: 1 });
      expect(Number(rows[1].vrijednost)).toBe(20);
    });
  });

  it("objekat ne vidi prijeme", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      await kao(db, "objekat");
      await expect(db.query("select * from magacin.zadnji_prijemi(10)")).rejects.toThrow(/nemate pravo/i);
    });
  });
});

describe("neispravan prijem", () => {
  it("prijem bez stavki se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await expect(prijem(db, s.dobavljac, [])).rejects.toThrow(/stavk/i);
    });
  });

  it("količina mora biti veća od nule", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 0, cijena: 2 }])).rejects.toThrow(
        /količina/i,
      );
    });
  });

  it("cijena ne može biti negativna", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: -1 }])).rejects.toThrow(
        /cijena/i,
      );
    });
  });

  it("nepoznat artikal se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await expect(
        prijem(db, s.dobavljac, [{ artikal_id: "00000000-0000-4000-8000-000000000000", kolicina: 1, cijena: 1 }]),
      ).rejects.toThrow(/artikal/i);
    });
  });

  it("isključen artikal se ne može primiti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "menadzer", "Šef2");
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [s.secer]);
      await db.query("reset role");
      await kao(db, "magacioner");
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }])).rejects.toThrow(
        /isključen/i,
      );
    });
  });

  it("isključen dobavljač se ne može koristiti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "menadzer", "Šef2");
      await db.query("select magacin.postavi_aktivnost_dobavljaca($1, false)", [s.dobavljac]);
      await db.query("reset role");
      await kao(db, "magacioner");
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }])).rejects.toThrow(
        /dobavljač/i,
      );
    });
  });

  it("pakovanje drugog artikla se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await expect(
        prijem(db, s.dobavljac, [{ artikal_id: s.secer, pakovanje_id: s.kutija, kolicina: 1, cijena: 1 }]),
      ).rejects.toThrow(/pakovanje/i);
    });
  });

  it("greška u jednoj stavci poništava cijeli prijem", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "magacioner");
      await db.query("savepoint a");
      await expect(
        prijem(db, s.dobavljac, [
          { artikal_id: s.secer, kolicina: 5, cijena: 2 },
          { artikal_id: s.mlijeko, kolicina: -1, cijena: 2 },
        ]),
      ).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect((await stanje(db)).get("Šećer")?.kolicina).toBe(0);
      const { rows } = await db.query("select count(*)::int as n from magacin.prijem");
      expect(rows[0].n).toBe(0);
    });
  });
});

describe("ko smije unijeti prijem", () => {
  it("objekat ne smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "objekat");
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }])).rejects.toThrow(
        /nemate pravo/i,
      );
    });
  });

  it("menadžer smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, "menadzer", "Šef2");
      await prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }]);
      expect((await stanje(db)).get("Šećer")?.kolicina).toBe(1);
    });
  });

  it("neprijavljen ne smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijaviKaoNeprijavljen(db);
      await expect(prijem(db, s.dobavljac, [{ artikal_id: s.secer, kolicina: 1, cijena: 1 }])).rejects.toThrow();
    });
  });
});
