import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { uTransakciji } from "./helpers";
import { kao, knjigaObjekta, naDostavi, pripremi, smjene, stavka, uZalihuObjekta, zalihaObjekta, zatvori } from "./svijet";

const izuzetak = (db: Client, artikal: string, kolicina: number, razlog: string) =>
  db.query("select magacin.dodaj_izuzetak($1, $2, $3)", [artikal, kolicina, razlog]);

const izuzeci = async (db: Client) => (await db.query("select * from magacin.izuzeci_tekuce_smjene()")).rows;
const upozorenja = async (db: Client) => (await db.query("select * from magacin.upozorenja_smjena(50)")).rows;

describe("izuzeci u toku smjene (razbijeno, proliveno)", () => {
  it("izuzetak smanjuje zalihu objekta i traži razlog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await izuzetak(db, s.cokolada, 2, "Razbijena čaša s čokoladom");
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(8);
      const [i] = await izuzeci(db);
      expect(i).toMatchObject({ artikal: "Topla čokolada", mjera: "kg", razlog: "Razbijena čaša s čokoladom" });
      expect(Number(i.kolicina)).toBe(2);
    });
  });

  it("bez razloga se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(izuzetak(db, s.cokolada, 2, "  ")).rejects.toThrow(/razlog/i);
    });
  });

  it("količina mora biti veća od nule", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(izuzetak(db, s.cokolada, 0, "Razbijeno")).rejects.toThrow(/količina/i);
    });
  });

  it("ne može biti više nego što objekat ima", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(izuzetak(db, s.cokolada, 11, "Razbijeno")).rejects.toThrow(/nema dovoljno.*na stanju 10/i);
    });
  });

  it("roba koja je tek na dostavi se ne može otpisati", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naDostavi(db, s, s.cokolada, 5, 4);
      await kao(db, s.sankOsoblje);
      await expect(izuzetak(db, s.cokolada, 1, "Razbijeno")).rejects.toThrow(/nema dovoljno/i);
    });
  });

  it("izuzetak je odvojen od obične potrošnje, ali ulazi u trošak po cijeni izdatog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await izuzetak(db, s.cokolada, 2, "Razbijeno");
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 6 }]);
      const knjiga = await knjigaObjekta(db, s);
      expect(knjiga.filter((k) => k.vrsta === "izuzetak")).toEqual([
        { vrsta: "izuzetak", kolicina: -2, cijena: 4, napomena: "Razbijeno" },
      ]);
      expect(knjiga.filter((k) => k.vrsta === "potrosnja")).toEqual([
        { vrsta: "potrosnja", kolicina: -2, cijena: 4, napomena: null },
      ]);
      // Ukupan trošak = potrošnja 2 × 4 + izuzetak 2 × 4 = 16; smjena ih prikazuje odvojeno.
      await kao(db, s.sef);
      const [z] = await smjene(db, s.sank);
      const c = stavka(z, "Topla čokolada");
      expect(Number(c.potrosnja)).toBe(2);
      expect(Number(c.izuzeci)).toBe(2);
      expect(Number(c.trosak)).toBe(8); // trošak obične potrošnje
      expect(Number(c.trosak_izuzetaka)).toBe(8);
      expect(Number(z.trosak)).toBe(8);
      expect(Number(z.trosak_izuzetaka)).toBe(8);
    });
  });

  it("izuzetak iz prethodne smjene se ne računa u sljedeću", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await izuzetak(db, s.cokolada, 2, "Razbijeno");
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 8 }]);
      expect(await izuzeci(db)).toHaveLength(0);
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 8 }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect([Number(c.pocetno), Number(c.izuzeci), Number(c.potrosnja)]).toEqual([8, 0, 0]);
    });
  });

  it("objekat ne vidi cijenu ni trošak izuzetka", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await izuzetak(db, s.cokolada, 2, "Razbijeno");
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 6 }]);
      const [z] = await smjene(db);
      expect(z.trosak_izuzetaka).toBeNull();
      expect(stavka(z, "Topla čokolada").trosak_izuzetaka).toBeNull();
    });
  });

  it("magacioner i menadžer ne dodaju izuzetke objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await kao(db, s.magacioner);
      await expect(izuzetak(db, s.cokolada, 1, "Razbijeno")).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("tuđi objekat ne može otpisati robu drugog objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await kao(db, s.kuhinjaOsoblje);
      await db.query("savepoint a");
      await expect(izuzetak(db, s.cokolada, 1, "Razbijeno")).rejects.toThrow(/nema dovoljno/i);
      await db.query("rollback to savepoint a");
      expect(await izuzeci(db)).toHaveLength(0);
    });
  });
});

describe("veće završno stanje od mogućeg", () => {
  it("traži razlog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await expect(zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 12 }])).rejects.toThrow(
        /veće od mogućeg.*razlog/i,
      );
    });
  });

  it("uz razlog ne blokira zatvaranje: potrošnja je nula, a višak ulazi u zalihu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 12, razlog: "Dobijeno od kuhinje" }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect(Number(c.potrosnja)).toBe(0);
      expect(Number(c.visak)).toBe(2);
      expect(c.razlog).toBe("Dobijeno od kuhinje");
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(12);
      expect(await knjigaObjekta(db, s, "potrosnja")).toHaveLength(0);
      const visak = await knjigaObjekta(db, s, "visak_pri_zatvaranju");
      expect(visak).toEqual([{ vrsta: "visak_pri_zatvaranju", kolicina: 2, cijena: 4, napomena: "Dobijeno od kuhinje" }]);
    });
  });

  it("višak artikla koji nije bio na zalihi (npr. dobijeno od kuhinje) uz razlog je dozvoljen", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await zatvori(db, "Emir", [{ artikal_id: s.mlijeko, zavrsno: 3, razlog: "Dobijeno od kuhinje" }]);
      expect(Number(stavka((await smjene(db))[0], "Mlijeko").visak)).toBe(3);
      expect((await zalihaObjekta(db)).get("Mlijeko")).toBe(3);
    });
  });

  it("menadžer vidi upozorenje s razlogom, imenom osobe i objektom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 12, razlog: "Dobijeno od kuhinje" }]);
      await kao(db, s.sef);
      const [u] = await upozorenja(db);
      expect(u).toMatchObject({
        objekat: "ŠANK HOTEL",
        artikal: "Topla čokolada",
        mjera: "kg",
        razlog: "Dobijeno od kuhinje",
        ime_osobe: "Emir",
      });
      expect(Number(u.visak)).toBe(2);
    });
  });

  it("bez viška nema upozorenja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      expect(await upozorenja(db)).toHaveLength(0);
    });
  });

  it("upozorenja vidi samo menadžer", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(upozorenja(db)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.magacioner);
      await expect(upozorenja(db)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("višak je u sljedećoj smjeni početno stanje kao i svako završno", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 12, razlog: "Dobijeno od kuhinje" }]);
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 9 }]);
      const c = stavka((await smjene(db))[0], "Topla čokolada");
      expect([Number(c.pocetno), Number(c.potrosnja)]).toEqual([12, 3]);
    });
  });

  it("višak se vrednuje po prosječnoj cijeni zalihe i ne mijenja je", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 12, razlog: "Dobijeno od kuhinje" }]);
      await kao(db, s.sef);
      const { rows } = await db.query("select prosjecna_cijena from magacin.zaliha_objekta($1)", [s.sank]);
      expect(Number(rows[0].prosjecna_cijena)).toBe(4);
    });
  });
});
