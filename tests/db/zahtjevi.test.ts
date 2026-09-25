import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKaoNeprijavljen, uTransakciji } from "./helpers";

import {
  jedan,
  kao,
  odbij,
  odobri,
  posalji,
  pripremi,
  zahtjevi,
} from "./svijet";

describe("slanje zahtjeva", () => {
  it("objekat šalje zahtjev sa statusom poslan i imenom osobe", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }, { artikal_id: s.mlijeko, kolicina: 12 }]);
      const z = await jedan(db, id);
      expect(z).toMatchObject({ status: "poslan", objekat: "ŠANK HOTEL", poslao: "Šank osoblje", odobrio: null, razlog: null });
      expect(z.stavke).toHaveLength(2);
      expect(Math.abs(Date.now() - new Date(z.vrijeme).getTime())).toBeLessThan(60_000);
    });
  });

  it("zahtjev u pakovanju se pretvara u osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.kafa, pakovanje_id: s.kutija, kolicina: 2 }]);
      const [stavka] = (await jedan(db, id)).stavke;
      expect(stavka).toMatchObject({ naziv: "Kafa", mjera: "kg", pakovanje: "kutija", faktor: 10 });
      expect(Number(stavka.trazena_kolicina)).toBe(2);
      expect(Number(stavka.trazena_osnovna)).toBe(20);
    });
  });

  it("objekat može tražiti samo artikle sa svog popisa", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(posalji(db, [{ artikal_id: s.brasno, kolicina: 1 }])).rejects.toThrow(/popis/i);
    });
  });

  it("jedan artikal van popisa poništava cijeli zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await db.query("savepoint a");
      await expect(
        posalji(db, [{ artikal_id: s.kafa, kolicina: 1 }, { artikal_id: s.brasno, kolicina: 1 }]),
      ).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect(await zahtjevi(db)).toHaveLength(0);
    });
  });

  it("isključen artikal se ne može tražiti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await db.query("select magacin.postavi_aktivnost_artikla($1, false)", [s.cokolada]);
      await kao(db, s.sankOsoblje);
      await expect(posalji(db, [{ artikal_id: s.cokolada, kolicina: 1 }])).rejects.toThrow(/popis|isključen/i);
    });
  });

  it("količina mora biti veća od nule", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(posalji(db, [{ artikal_id: s.kafa, kolicina: 0 }])).rejects.toThrow(/količina/i);
    });
  });

  it("zahtjev bez stavki se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(posalji(db, [])).rejects.toThrow(/stavk/i);
    });
  });

  it("pakovanje drugog artikla se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(posalji(db, [{ artikal_id: s.cokolada, pakovanje_id: s.kutija, kolicina: 1 }])).rejects.toThrow(
        /pakovanje/i,
      );
    });
  });

  it("magacioner i menadžer ne šalju zahtjeve, objekat jedini", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("savepoint a");
      await expect(posalji(db, [{ artikal_id: s.kafa, kolicina: 1 }])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.sef);
      await expect(posalji(db, [{ artikal_id: s.kafa, kolicina: 1 }])).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("osoblje koje nije vezano za objekat ne može slati zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      const bez = await napraviKorisnika(db, { ime: "Bez objekta", uloga: "objekat" });
      await kao(db, bez);
      await expect(posalji(db, [{ artikal_id: s.kafa, kolicina: 1 }])).rejects.toThrow(/nije vezan/i);
    });
  });

  it("neprijavljen ne može slati zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await prijaviKaoNeprijavljen(db);
      await expect(posalji(db, [{ artikal_id: s.kafa, kolicina: 1 }])).rejects.toThrow();
    });
  });
});

describe("odobravanje", () => {
  it("puno odobravanje: status odobren, sve količine kao tražene, ime i vrijeme magacionera", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }, { artikal_id: s.mlijeko, kolicina: 12 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      const z = await jedan(db, id);
      expect(z).toMatchObject({ status: "odobren", odobrio: "Amra", razlog: null });
      expect(z.odluka_vrijeme).not.toBeNull();
      expect(z.stavke.map((x: { odobrena_kolicina: string }) => Number(x.odobrena_kolicina)).sort((a: number, b: number) => a - b)).toEqual([5, 12]);
    });
  });

  it("odobravanje manje količine po stavci; nenavedene stavke se odobravaju u cijelosti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 10 }, { artikal_id: s.mlijeko, kolicina: 12 }]);
      await kao(db, s.magacioner);
      const cokolada = (await jedan(db, id)).stavke.find((x: { naziv: string }) => x.naziv === "Topla čokolada");
      await odobri(db, id, [{ stavka_id: cokolada.id, kolicina: 4 }]);
      const stavke = (await jedan(db, id)).stavke;
      const po = (n: string) => stavke.find((x: { naziv: string }) => x.naziv === n);
      expect(Number(po("Topla čokolada").odobrena_kolicina)).toBe(4);
      expect(Number(po("Mlijeko").odobrena_kolicina)).toBe(12);
    });
  });

  it("manja količina u pakovanju se pretvara u osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.kafa, pakovanje_id: s.kutija, kolicina: 3 }]);
      await kao(db, s.magacioner);
      const [st] = (await jedan(db, id)).stavke;
      await odobri(db, id, [{ stavka_id: st.id, kolicina: 1 }]);
      const [nova] = (await jedan(db, id)).stavke;
      expect(Number(nova.odobrena_kolicina)).toBe(1);
      expect(Number(nova.odobrena_osnovna)).toBe(10);
      expect(Number(nova.trazena_osnovna)).toBe(30);
    });
  });

  it("ne može se odobriti više nego što je traženo", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      const [st] = (await jedan(db, id)).stavke;
      await expect(odobri(db, id, [{ stavka_id: st.id, kolicina: 6 }])).rejects.toThrow(/više nego što je traženo/i);
    });
  });

  it("negativna količina se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      const [st] = (await jedan(db, id)).stavke;
      await expect(odobri(db, id, [{ stavka_id: st.id, kolicina: -1 }])).rejects.toThrow(/količina/i);
    });
  });

  it("odobravanje bez ijedne količine se odbija (treba odbiti zahtjev uz razlog)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      const [st] = (await jedan(db, id)).stavke;
      await expect(odobri(db, id, [{ stavka_id: st.id, kolicina: 0 }])).rejects.toThrow(/odbijte/i);
    });
  });

  it("stavka drugog zahtjeva se ne može odobriti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const a = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const b = await posalji(db, [{ artikal_id: s.mlijeko, kolicina: 5 }]);
      await kao(db, s.magacioner);
      const [stB] = (await jedan(db, b)).stavke;
      await expect(odobri(db, a, [{ stavka_id: stB.id, kolicina: 1 }])).rejects.toThrow(/stavka/i);
    });
  });

  it("zahtjev se ne može odobriti dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      await expect(odobri(db, id)).rejects.toThrow(/već obrađen/i);
    });
  });

  it("magacioner ne može odobriti nepostojeći zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await expect(odobri(db, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/zahtjev/i);
    });
  });

  it("objekat ne može odobriti ni svoj zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await expect(odobri(db, id)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("menadžer može odobriti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.sef);
      await odobri(db, id);
      expect((await jedan(db, id)).status).toBe("odobren");
    });
  });
});

describe("odbijanje", () => {
  it("odbijanje traži razlog, a objekat ga vidi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odbij(db, id, "Nema na stanju");
      await kao(db, s.sankOsoblje);
      expect(await jedan(db, id)).toMatchObject({ status: "odbijen", razlog: "Nema na stanju", odobrio: "Amra" });
    });
  });

  it("odbijanje bez razloga se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await expect(odbij(db, id, "   ")).rejects.toThrow(/razlog/i);
    });
  });

  it("odbijen zahtjev se ne može odobriti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odbij(db, id, "Nema");
      await expect(odobri(db, id)).rejects.toThrow(/već obrađen/i);
    });
  });

  it("odobren zahtjev koji još nije izdat može se odbiti uz razlog (npr. nema robe)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      await odbij(db, id, "Robe nema na stanju");
      await kao(db, s.sankOsoblje);
      expect(await jedan(db, id)).toMatchObject({ status: "odbijen", razlog: "Robe nema na stanju" });
    });
  });

  it("odobren zahtjev se ne može odbiti bez razloga", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      await expect(odbij(db, id, " ")).rejects.toThrow(/razlog/i);
    });
  });

  it("izdat zahtjev se više ne može odbiti", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [s.dobavljac, JSON.stringify([{ artikal_id: s.cokolada, kolicina: 10, cijena: 4 }])]);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      await db.query("select magacin.izdaj_zahtjev($1)", [id]);
      await expect(odbij(db, id, "Predomislio sam se")).rejects.toThrow(/već obrađen/i);
    });
  });

  it("izdavanje s nulom za stavku kojoj nema robe prolazi za ostale stavke", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [s.dobavljac, JSON.stringify([{ artikal_id: s.cokolada, kolicina: 10, cijena: 4 }])]);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }, { artikal_id: s.mlijeko, kolicina: 3 }]); // mlijeka nema
      await kao(db, s.magacioner);
      await odobri(db, id);
      const mlijeko = (await jedan(db, id)).stavke.find((x: { naziv: string }) => x.naziv === "Mlijeko");
      await db.query("select magacin.izdaj_zahtjev($1, $2::jsonb)", [id, JSON.stringify([{ stavka_id: mlijeko.id, kolicina: 0 }])]);
      const z = await jedan(db, id);
      expect(z.status).toBe("na_dostavi");
      expect(Number(z.stavke.find((x: { naziv: string }) => x.naziv === "Mlijeko").izdana_kolicina)).toBe(0);
      expect(Number(z.stavke.find((x: { naziv: string }) => x.naziv === "Topla čokolada").izdana_kolicina)).toBe(5);
    });
  });

  it("odbijen zahtjev se ne može odbiti ponovo", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odbij(db, id, "Nema");
      await expect(odbij(db, id, "Opet nema")).rejects.toThrow(/već obrađen/i);
    });
  });

  it("objekat ne može odbiti zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await expect(odbij(db, id, "Ne treba")).rejects.toThrow(/nemate pravo/i);
    });
  });
});

describe("ko šta vidi", () => {
  it("objekat vidi samo zahtjeve svog objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.kuhinjaOsoblje);
      await posalji(db, [{ artikal_id: s.brasno, kolicina: 25 }]);
      const kuhinja = await zahtjevi(db);
      expect(kuhinja.map((z) => z.objekat)).toEqual(["KUHINJA"]);
      await kao(db, s.sankOsoblje);
      expect((await zahtjevi(db)).map((z) => z.objekat)).toEqual(["ŠANK HOTEL"]);
    });
  });

  it("magacioner vidi zahtjeve svih objekata, najnoviji prvi, i može filtrirati po statusu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const prvi = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.kuhinjaOsoblje);
      const drugi = await posalji(db, [{ artikal_id: s.brasno, kolicina: 25 }]);
      await kao(db, s.magacioner);
      await odobri(db, prvi);
      const svi = await zahtjevi(db);
      expect(svi.map((z) => z.id)).toEqual([drugi, prvi]);
      expect((await zahtjevi(db, ["poslan"])).map((z) => z.id)).toEqual([drugi]);
      expect((await zahtjevi(db, ["odobren", "odbijen"])).map((z) => z.id)).toEqual([prvi]);
    });
  });

  it("magacioner uz stavku vidi trenutno stanje magacina, a objekat ga ne vidi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
        s.dobavljac,
        JSON.stringify([{ artikal_id: s.cokolada, kolicina: 8, cijena: 3 }]),
      ]);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }, { artikal_id: s.mlijeko, kolicina: 2 }]);
      const kaoObjekat = (await jedan(db, id)).stavke;
      expect(kaoObjekat.every((x: { na_stanju: unknown }) => x.na_stanju === null)).toBe(true);
      await kao(db, s.magacioner);
      const kaoMagacin = (await jedan(db, id)).stavke;
      const po = (n: string) => kaoMagacin.find((x: { naziv: string }) => x.naziv === n);
      expect(Number(po("Topla čokolada").na_stanju)).toBe(8);
      expect(Number(po("Mlijeko").na_stanju)).toBe(0);
    });
  });

  it("zahtjevi se ne mogu upisivati ni mijenjati direktno u tabelama", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await db.query("savepoint a");
      await expect(db.query("update magacin.zahtjev set status = 'odobren' where id = $1", [id])).rejects.toThrow(
        /permission denied/i,
      );
      await db.query("rollback to savepoint a");
      await expect(
        db.query("update magacin.zahtjev_stavka set trazena_kolicina = 1000 where zahtjev_id = $1", [id]),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("neprijavljen ne vidi zahtjeve", async () => {
    await uTransakciji(async (db) => {
      await pripremi(db);
      await prijaviKaoNeprijavljen(db);
      await expect(zahtjevi(db)).rejects.toThrow();
    });
  });
});
