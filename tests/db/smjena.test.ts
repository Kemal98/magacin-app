import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { uTransakciji } from "./helpers";
import {
  kao,
  knjigaObjekta,
  naDostavi,
  pripremi,
  smjene,
  stavka,
  uZalihuObjekta,
  zalihaObjekta,
  zatvori,
} from "./svijet";

describe("zatvaranje smjene: potrošnja i trošak", () => {
  it("potrošnja je razlika između mogućeg i završnog stanja, a trošak ide po cijeni izdatog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      const [z] = await smjene(db);
      const c = stavka(z, "Topla čokolada");
      expect(Number(c.pocetno)).toBe(0);
      expect(Number(c.primljeno)).toBe(10);
      expect(Number(c.izuzeci)).toBe(0);
      expect(Number(c.zavrsno)).toBe(7);
      expect(Number(c.potrosnja)).toBe(3);
      expect(c.trosak).toBeNull(); // objekat ne vidi cijene
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(7);
    });
  });

  it("potrošnja je početno + primljeno − izuzeci − završno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await db.query("select magacin.dodaj_izuzetak($1, 2, 'Razbijeno')", [s.cokolada]);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 6 }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect([Number(c.pocetno), Number(c.primljeno), Number(c.izuzeci), Number(c.zavrsno), Number(c.potrosnja)]).toEqual([0, 10, 2, 6, 2]);
    });
  });

  it("trošak se knjiži u knjigu objekta po cijeni izdatog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      const potrosnja = await knjigaObjekta(db, s, "potrosnja");
      expect(potrosnja).toEqual([{ vrsta: "potrosnja", kolicina: -3, cijena: 4, napomena: null }]);
    });
  });

  it("menadžer vidi trošak smjene", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      const [z] = await smjene(db, s.sank);
      expect(Number(z.trosak)).toBe(12);
      expect(Number(stavka(z, "Topla čokolada").trosak)).toBe(12);
    });
  });

  it("izdavanje ne knjiži trošak, a zatvaranje smjene da", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      expect(await knjigaObjekta(db, s, "potrosnja")).toHaveLength(0);
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      expect(await knjigaObjekta(db, s, "potrosnja")).toHaveLength(1);
    });
  });

  it("završno jednako mogućem: potrošnja je nula i ništa se ne knjiži", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 10 }]);
      expect(Number(stavka((await smjene(db))[0], "Topla čokolada").potrosnja)).toBe(0);
      expect(await knjigaObjekta(db, s, "potrosnja")).toHaveLength(0);
    });
  });
});

describe("početno stanje sljedeće smjene", () => {
  it("početno stanje je završno stanje prethodne smjene", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 5 }]);
      const [druga, prva] = await smjene(db);
      expect(Number(stavka(prva, "Topla čokolada").zavrsno)).toBe(7);
      const c = stavka(druga, "Topla čokolada");
      expect(Number(c.pocetno)).toBe(7);
      expect(Number(c.primljeno)).toBe(0);
      expect(Number(c.potrosnja)).toBe(2);
    });
  });

  it("primljeno u novoj smjeni se dodaje, a trošak ide po ponderisanoj cijeni zalihe objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]); // 7 kom po 4
      await uZalihuObjekta(db, s, s.cokolada, 5, 6); // magacin: 5 kom po 6
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 9 }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect([Number(c.pocetno), Number(c.primljeno), Number(c.zavrsno), Number(c.potrosnja)]).toEqual([7, 5, 9, 3]);
      // Zaliha objekta: 7 × 4 + 5 × 6 = 58 na 12 kom → prosjek 4,8333; trošak 3 × 4,8333 = 14,5
      await kao(db, s.sef);
      expect(Number(stavka((await smjene(db, s.sank))[0], "Topla čokolada").trosak)).toBeCloseTo(14.5, 8);
    });
  });

  it("kasnija promjena cijene u magacinu ne mijenja već knjižen trošak", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      // Magacin sada dobija istu robu po mnogo većoj cijeni.
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
        s.dobavljac,
        JSON.stringify([{ artikal_id: s.cokolada, kolicina: 100, cijena: 50 }]),
      ]);
      await kao(db, s.sef);
      expect(Number((await smjene(db, s.sank))[0].trosak)).toBe(12);
      const potrosnja = await knjigaObjekta(db, s, "potrosnja");
      expect(potrosnja[0]).toMatchObject({ kolicina: -3, cijena: 4 });
    });
  });

  it("zatvorena smjena ima ime osobe koja ju je zatvorila i vrijeme", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "  Emir Hodžić ", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      const [z] = await smjene(db);
      expect(z.ime_osobe).toBe("Emir Hodžić");
      expect(Math.abs(Date.now() - new Date(z.zatvorena).getTime())).toBeLessThan(60_000);
    });
  });
});

describe("smjena se ne može zatvoriti nepotpuna", () => {
  it("bez završnog stanja za artikal koji je na zalihi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await uZalihuObjekta(db, s, s.mlijeko, 5, 1);
      await expect(zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }])).rejects.toThrow(
        /završno stanje za: Mlijeko/i,
      );
    });
  });

  it("nijedan artikal bez završnog stanja se ne preskače", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(zatvori(db, "Emir", [])).rejects.toThrow(/završno stanje za: Topla čokolada/i);
    });
  });

  it("bez imena osobe", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(zatvori(db, "   ", [{ artikal_id: s.cokolada, zavrsno: 7 }])).rejects.toThrow(/ime osobe/i);
    });
  });

  it("neispravno završno stanje (negativno) se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: -1 }])).rejects.toThrow(/završno stanje/i);
    });
  });

  it("neuspjelo zatvaranje ništa ne mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await uZalihuObjekta(db, s, s.mlijeko, 5, 1);
      await db.query("savepoint a");
      await expect(zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }])).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect(await smjene(db)).toHaveLength(0);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(10);
      expect(await knjigaObjekta(db, s, "potrosnja")).toHaveLength(0);
    });
  });

  it("artikal koji nije ni na popisu ni na zalihi se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(zatvori(db, "Emir", [{ artikal_id: s.brasno, zavrsno: 1 }])).rejects.toThrow(/popis/i);
    });
  });

  it("objekat bez robe može zatvoriti smjenu bez unosa", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", []);
      expect(await smjene(db)).toHaveLength(1);
    });
  });

  it("isti artikal dvaput u unosu se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(
        zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }, { artikal_id: s.cokolada, zavrsno: 6 }]),
      ).rejects.toThrow(/dvaput/i);
    });
  });
});

describe("roba na dostavi", () => {
  it("nepotvrđena roba ne ulazi u brojanje i ostaje u zalihi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      const id = await naDostavi(db, s, s.cokolada, 5, 4); // još nije stiglo
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]); // brojano samo ono što je stiglo
      expect(Number(stavka((await smjene(db))[0], "Topla čokolada").potrosnja)).toBe(3);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(12); // 7 + 5 na putu
      // Kad stigne, u sljedećoj smjeni je "primljeno".
      await db.query("select magacin.potvrdi_primljeno($1)", [id]);
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 12 }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect([Number(c.pocetno), Number(c.primljeno), Number(c.potrosnja)]).toEqual([7, 5, 0]);
    });
  });
});

describe("ko smije zatvoriti smjenu", () => {
  it("magacioner i menadžer ne zatvaraju smjenu objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("savepoint a");
      await expect(zatvori(db, "Amra", [])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.sef);
      await expect(zatvori(db, "Šef", [])).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("objekat vidi samo svoje smjene", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", []);
      await kao(db, s.kuhinjaOsoblje);
      expect(await smjene(db)).toHaveLength(0);
      await db.query("savepoint a");
      await expect(smjene(db, s.sank)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("smjene se ne mogu mijenjati direktno u tabelama", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(db.query("delete from magacin.smjena")).rejects.toThrow(/permission denied/i);
    });
  });
});

describe("raspored smjena (satnice)", () => {
  const postavi = (db: Client, objekat: string, r: unknown[]) =>
    db.query("select magacin.postavi_smjene_objekta($1, $2::jsonb)", [objekat, JSON.stringify(r)]);
  const raspored = async (db: Client, objekat: string | null = null) =>
    (await db.query("select * from magacin.smjene_raspored($1)", [objekat])).rows;

  it("menadžer zadaje smjene objekta s nazivom i satnicom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.sank, [
        { naziv: "Prva smjena", pocetak: "08:00", kraj: "16:00" },
        { naziv: "Druga smjena", pocetak: "16:00", kraj: "00:00" },
      ]);
      const r = await raspored(db, s.sank);
      expect(r.map((x) => [x.naziv, x.pocetak, x.kraj])).toEqual([
        ["Prva smjena", "08:00:00", "16:00:00"],
        ["Druga smjena", "16:00:00", "00:00:00"],
      ]);
    });
  });

  it("novi raspored zamjenjuje raniji", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.sank, [{ naziv: "A", pocetak: "08:00", kraj: "16:00" }]);
      await postavi(db, s.sank, [{ naziv: "B", pocetak: "09:00", kraj: "17:00" }]);
      expect((await raspored(db, s.sank)).map((x) => x.naziv)).toEqual(["B"]);
    });
  });

  it("odbija neispravnu satnicu i prazan naziv", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await db.query("savepoint a");
      await expect(postavi(db, s.sank, [{ naziv: "A", pocetak: "25:00", kraj: "16:00" }])).rejects.toThrow(/satnic/i);
      await db.query("rollback to savepoint a");
      await expect(postavi(db, s.sank, [{ naziv: " ", pocetak: "08:00", kraj: "16:00" }])).rejects.toThrow(/naziv/i);
      await db.query("rollback to savepoint a");
      await expect(postavi(db, s.sank, [{ naziv: "A", pocetak: "08:00", kraj: "08:00" }])).rejects.toThrow(/satnic/i);
    });
  });

  it("objekat vidi raspored svog objekta, a menadžer ga jedini mijenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.sank, [{ naziv: "A", pocetak: "08:00", kraj: "16:00" }]);
      await kao(db, s.sankOsoblje);
      expect((await raspored(db)).map((x) => x.naziv)).toEqual(["A"]);
      await db.query("savepoint a");
      await expect(postavi(db, s.sank, [])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.kuhinjaOsoblje);
      expect(await raspored(db)).toHaveLength(0);
    });
  });

  it("trenutna smjena se određuje po lokalnom vremenu (Sarajevo), i preko ponoći", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.sank, [
        { naziv: "Jutarnja", pocetak: "08:00", kraj: "16:00" },
        { naziv: "Noćna", pocetak: "22:00", kraj: "06:00" },
      ]);
      const u = async (vrijeme: string) =>
        (await db.query("select naziv from magacin.trenutna_smjena($1, $2::timestamptz)", [s.sank, vrijeme])).rows[0]?.naziv;
      expect(await u("2026-09-25 10:00 Europe/Sarajevo")).toBe("Jutarnja");
      expect(await u("2026-09-25 23:30 Europe/Sarajevo")).toBe("Noćna");
      expect(await u("2026-09-26 02:00 Europe/Sarajevo")).toBe("Noćna");
      expect(await u("2026-09-25 18:00 Europe/Sarajevo")).toBeUndefined();
    });
  });

  it("zatvorena smjena pamti naziv smjene iz rasporeda", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await postavi(db, s.sank, [
        { naziv: "Prva", pocetak: "00:00", kraj: "12:00" },
        { naziv: "Druga", pocetak: "12:00", kraj: "00:00" },
      ]);
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", []);
      expect(["Prva", "Druga"]).toContain((await smjene(db))[0].naziv);
    });
  });
});
