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

const otpisi = (db: Client, artikal: string, kolicina: number, razlog: string, pakovanje: string | null = null) =>
  db.query("select magacin.otpisi_iz_magacina($1, $2, $3, $4)", [artikal, kolicina, razlog, pakovanje]);

const stanje = async (db: Client, artikal: string) => {
  const { rows } = await db.query(
    "select kolicina, prosjecna_cijena from magacin.zaliha_magacina where artikal_id = $1",
    [artikal],
  );
  return rows[0] ? { kolicina: Number(rows[0].kolicina), cijena: Number(rows[0].prosjecna_cijena) } : undefined;
};

const lista = async (db: Client) => (await db.query("select * from magacin.otpisi_magacina(50)")).rows;

describe("otpis magacina", () => {
  it("skida zalihu magacina i traži razlog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await otpisi(db, s.mlijeko, 3, "Isteklo rok trajanja");
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(17);
    });
  });

  it("bez razloga se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await expect(otpisi(db, s.mlijeko, 3, "   ")).rejects.toThrow(/razlog/i);
    });
  });

  it("količina mora biti veća od nule", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await expect(otpisi(db, s.mlijeko, 0, "Pokvareno")).rejects.toThrow(/količina/i);
    });
  });

  it("otpis iznad stanja se odbija s jasnom porukom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 4, 1.5);
      await expect(otpisi(db, s.mlijeko, 5, "Pokvareno")).rejects.toThrow(/Mlijeko.*na stanju 4.*otpis 5/i);
    });
  });

  it("artikal koji nikad nije primljen ima stanje nula", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(otpisi(db, s.mlijeko, 1, "Pokvareno")).rejects.toThrow(/na stanju 0/i);
    });
  });

  it("neuspjeli otpis ništa ne mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 4, 1.5);
      await db.query("savepoint a");
      await expect(otpisi(db, s.mlijeko, 5, "Pokvareno")).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(4);
      expect(await lista(db)).toHaveLength(0);
    });
  });

  it("može se otpisati sve što je na stanju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 4, 1.5);
      await otpisi(db, s.mlijeko, 4, "Sve isteklo");
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(0);
    });
  });

  it("otpis u pakovanju se pretvara u osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.kafa, 100, 2);
      await otpisi(db, s.kafa, 2, "Vlaga oštetila kutije", s.kutija); // 2 × 10 kg
      expect((await stanje(db, s.kafa))?.kolicina).toBe(80);
      const [o] = await lista(db);
      expect(Number(o.kolicina)).toBe(20);
    });
  });

  it("pakovanje drugog artikla se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await expect(otpisi(db, s.mlijeko, 1, "Pokvareno", s.kutija)).rejects.toThrow(/pakovanje/i);
    });
  });
});

describe("vrijednost otpisa", () => {
  it("računa se po prosječnoj cijeni magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 10, 1);
      await naStanje(db, s, s.mlijeko, 10, 2); // prosjek 1,50
      await otpisi(db, s.mlijeko, 4, "Isteklo");
      const [o] = await lista(db);
      expect(Number(o.cijena)).toBe(1.5);
      expect(Number(o.vrijednost)).toBe(6);
    });
  });

  it("otpis ne mijenja prosječnu cijenu preostale zalihe", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 10, 1);
      await naStanje(db, s, s.mlijeko, 10, 2);
      await otpisi(db, s.mlijeko, 4, "Isteklo");
      expect(await stanje(db, s.mlijeko)).toEqual({ kolicina: 16, cijena: 1.5 });
    });
  });

  it("kasnija promjena cijene ne mijenja vrijednost već otpisanog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 10, 1);
      await otpisi(db, s.mlijeko, 4, "Isteklo");
      await naStanje(db, s, s.mlijeko, 100, 50);
      const [o] = await lista(db);
      expect(Number(o.vrijednost)).toBe(4);
    });
  });
});

describe("otpis u knjizi i pregledu", () => {
  it("bilježi se u knjigu magacina s razlogom, imenom osobe i vremenom, odvojeno od izdavanja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await otpisi(db, s.mlijeko, 3, "Isteklo rok trajanja");
      const { rows } = await db.query(
        "select vrsta, kolicina, cijena, korisnik_id, napomena, vrijeme from magacin.kretanje_magacina where vrsta = 'otpis'",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ vrsta: "otpis", korisnik_id: s.magacioner, napomena: "Isteklo rok trajanja" });
      expect(Number(rows[0].kolicina)).toBe(-3);
      expect(Number(rows[0].cijena)).toBe(1.5);
      expect(Math.abs(Date.now() - new Date(rows[0].vrijeme).getTime())).toBeLessThan(60_000);
    });
  });

  it("menadžer odmah vidi otpis s imenom osobe, vremenom i vrijednošću, najnoviji prvi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await naStanje(db, s, s.brasno, 10, 2);
      await otpisi(db, s.mlijeko, 3, "Isteklo");
      await otpisi(db, s.brasno, 1, "Pokidana vreća");
      await kao(db, s.sef);
      const r = await lista(db);
      expect(r.map((x) => x.artikal)).toEqual(["Brašno", "Mlijeko"]);
      expect(r[0]).toMatchObject({ razlog: "Pokidana vreća", ime: "Amra", mjera: "kg" });
      expect(Number(r[0].vrijednost)).toBe(2);
      expect(Number(r[1].vrijednost)).toBe(4.5);
      expect(Math.abs(Date.now() - new Date(r[0].vrijeme).getTime())).toBeLessThan(60_000);
    });
  });

  it("izdavanje i prijem se ne pojavljuju u pregledu otpisa", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      expect(await lista(db)).toHaveLength(0);
    });
  });

  it("otpis ne dira zalihu objekata ni knjigu objekata", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await otpisi(db, s.mlijeko, 3, "Isteklo");
      const { rows } = await db.query("select count(*)::int as n from magacin.kretanje_objekta");
      expect(rows[0].n).toBe(0);
    });
  });

  it("stanje magacina odmah prikazuje umanjenu količinu i vrijednost", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await otpisi(db, s.mlijeko, 4, "Isteklo");
      const { rows } = await db.query("select * from magacin.stanje_magacina('prehrana') where naziv = 'Mlijeko'");
      expect(Number(rows[0].kolicina)).toBe(16);
      expect(Number(rows[0].vrijednost)).toBe(24);
    });
  });
});

describe("ko smije otpisivati i gledati otpis", () => {
  it("menadžer smije otpisati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await kao(db, s.sef);
      await otpisi(db, s.mlijeko, 1, "Isteklo");
      expect((await stanje(db, s.mlijeko))?.kolicina).toBe(19);
    });
  });

  it("objekat ne smije otpisati ni vidjeti otpise magacina", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.mlijeko, 20, 1.5);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(otpisi(db, s.mlijeko, 1, "Isteklo")).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await expect(lista(db)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("neprijavljen ne smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijaviKaoNeprijavljen(db);
      await expect(otpisi(db, s.mlijeko, 1, "Isteklo")).rejects.toThrow();
    });
  });
});
