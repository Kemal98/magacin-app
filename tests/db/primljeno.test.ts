import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { prijaviKaoNeprijavljen, uTransakciji } from "./helpers";
import { jedan, kao, odbij, odobri, posalji, pripremi, type Svijet } from "./svijet";

async function naStanje(db: Client, s: Svijet, artikal: string, kolicina: number, cijena: number) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
}

async function potvrdi(db: Client, zahtjev: string, stavke: { stavka_id: string; kolicina: number }[] | null = null) {
  await db.query("select magacin.potvrdi_primljeno($1, $2::jsonb)", [zahtjev, stavke ? JSON.stringify(stavke) : null]);
}

/** Objekat traži, magacioner odobrava i izdaje; zahtjev je na dostavi. Vraća id zahtjeva. */
async function naDostavi(
  db: Client,
  s: Svijet,
  stavke: { artikal_id: string; pakovanje_id?: string | null; kolicina: number }[],
) {
  await kao(db, s.sankOsoblje);
  const id = await posalji(db, stavke);
  await kao(db, s.magacioner);
  await odobri(db, id);
  await db.query("select magacin.izdaj_zahtjev($1)", [id]);
  await kao(db, s.sankOsoblje);
  return id;
}

const zalihaObjekta = async (db: Client, objekat: string | null = null) => {
  const { rows } = await db.query("select * from magacin.zaliha_objekta($1)", [objekat]);
  return new Map(rows.map((r) => [r.naziv as string, Number(r.kolicina)]));
};

const stanjeMagacina = async (db: Client, artikal: string) => {
  const { rows } = await db.query("select kolicina from magacin.zaliha_magacina where artikal_id = $1", [artikal]);
  return Number(rows[0].kolicina);
};

describe("STIGLO: potvrda da je roba primljena", () => {
  it("potvrda bez unosa: status primljeno, primljeno je jednako izdanom, bez razlike", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await potvrdi(db, id);
      const z = await jedan(db, id);
      expect(z.status).toBe("primljeno");
      expect(z.primio).toBe("Šank osoblje");
      expect(Math.abs(Date.now() - new Date(z.primljeno_vrijeme).getTime())).toBeLessThan(60_000);
      const [st] = z.stavke;
      expect(Number(st.primljena_kolicina)).toBe(5);
      expect(Number(st.razlika_osnovna)).toBe(0);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(5);
    });
  });

  it("potvrda s drugačijom količinom upisuje stvarnu količinu i razliku", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      const [nova] = (await jedan(db, id)).stavke;
      expect(Number(nova.izdana_kolicina)).toBe(5);
      expect(Number(nova.primljena_kolicina)).toBe(3);
      expect(Number(nova.razlika_osnovna)).toBe(-2);
    });
  });

  it("zaliha objekta se ažurira prema potvrđenoj količini", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(5); // izdato, još nepotvrđeno
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(3);
    });
  });

  it("razlika se knjiži u knjigu objekta po cijeni izdatog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      await kao(db, s.magacioner); // knjiga objekta sadrži cijene, pa je čita magacin
      const { rows } = await db.query(
        "select vrsta, kolicina, cijena, korisnik_id from magacin.kretanje_objekta where zahtjev_id = $1 order by id",
        [id],
      );
      expect(rows.map((r) => r.vrsta)).toEqual(["izdavanje", "razlika_pri_prijemu"]);
      expect(Number(rows[1].kolicina)).toBe(-2);
      expect(Number(rows[1].cijena)).toBe(4);
      expect(rows[1].korisnik_id).toBe(s.sankOsoblje);
    });
  });

  it("potvrda bez razlike ne dodaje ništa u knjigu objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await potvrdi(db, id);
      await kao(db, s.magacioner);
      const { rows } = await db.query("select count(*)::int as n from magacin.kretanje_objekta where zahtjev_id = $1", [id]);
      expect(rows[0].n).toBe(1);
    });
  });

  it("pakovanje: primljeno u pakovanju se pretvara u osnovnu mjeru", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.kafa, 100, 2);
      const id = await naDostavi(db, s, [{ artikal_id: s.kafa, pakovanje_id: s.kutija, kolicina: 2 }]); // 20 kg
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 1.5 }]);
      const [nova] = (await jedan(db, id)).stavke;
      expect(Number(nova.primljena_osnovna)).toBe(15);
      expect(Number(nova.razlika_osnovna)).toBe(-5);
      expect((await zalihaObjekta(db)).get("Kafa")).toBe(15);
    });
  });

  it("ništa nije stiglo: primljeno može biti nula", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 0 }]);
      expect((await jedan(db, id)).status).toBe("primljeno");
      expect((await zalihaObjekta(db)).has("Topla čokolada")).toBe(false);
    });
  });

  it("potvrda ne vraća robu u magacin", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      await kao(db, s.magacioner);
      expect(await stanjeMagacina(db, s.cokolada)).toBe(15);
    });
  });

  it("stavke koje nisu navedene se primaju u izdanoj količini", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      const id = await naDostavi(db, s, [
        { artikal_id: s.cokolada, kolicina: 5 },
        { artikal_id: s.mlijeko, kolicina: 8 },
      ]);
      const cok = (await jedan(db, id)).stavke.find((x: { naziv: string }) => x.naziv === "Topla čokolada");
      await potvrdi(db, id, [{ stavka_id: cok.id, kolicina: 4 }]);
      const z = await zalihaObjekta(db);
      expect(z.get("Topla čokolada")).toBe(4);
      expect(z.get("Mlijeko")).toBe(8);
    });
  });
});

describe("neispravna potvrda", () => {
  it("ne može se primiti više nego što je izdato", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await expect(potvrdi(db, id, [{ stavka_id: st.id, kolicina: 6 }])).rejects.toThrow(/više nego što je poslano/i);
    });
  });

  it("negativna količina se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await expect(potvrdi(db, id, [{ stavka_id: st.id, kolicina: -1 }])).rejects.toThrow(/količina/i);
    });
  });

  it("stavka drugog zahtjeva se odbija", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      const a = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const b = await naDostavi(db, s, [{ artikal_id: s.mlijeko, kolicina: 5 }]);
      const [stB] = (await jedan(db, b)).stavke;
      await expect(potvrdi(db, a, [{ stavka_id: stB.id, kolicina: 1 }])).rejects.toThrow(/stavka/i);
    });
  });

  it("neuspjela potvrda ne mijenja ništa (sve ili ništa)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      const id = await naDostavi(db, s, [
        { artikal_id: s.cokolada, kolicina: 5 },
        { artikal_id: s.mlijeko, kolicina: 5 },
      ]);
      const stavke = (await jedan(db, id)).stavke;
      const cok = stavke.find((x: { naziv: string }) => x.naziv === "Topla čokolada");
      const mlj = stavke.find((x: { naziv: string }) => x.naziv === "Mlijeko");
      await db.query("savepoint a");
      await expect(
        potvrdi(db, id, [{ stavka_id: cok.id, kolicina: 2 }, { stavka_id: mlj.id, kolicina: 99 }]),
      ).rejects.toThrow();
      await db.query("rollback to savepoint a");
      expect((await jedan(db, id)).status).toBe("na_dostavi");
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(5);
    });
  });
});

describe("zabranjeni prelazi", () => {
  it("poslan zahtjev se ne može potvrditi kao primljen", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await expect(potvrdi(db, id)).rejects.toThrow(/nije na dostavi/i);
    });
  });

  it("odobren (još neizdat) zahtjev se ne može potvrditi kao primljen", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odobri(db, id);
      await kao(db, s.sankOsoblje);
      await expect(potvrdi(db, id)).rejects.toThrow(/nije na dostavi/i);
    });
  });

  it("odbijen zahtjev se ne može potvrditi kao primljen", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      const id = await posalji(db, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await odbij(db, id, "Nema");
      await kao(db, s.sankOsoblje);
      await expect(potvrdi(db, id)).rejects.toThrow(/nije na dostavi/i);
    });
  });

  it("zahtjev se ne može potvrditi dvaput", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await potvrdi(db, id);
      await db.query("savepoint a");
      await expect(potvrdi(db, id)).rejects.toThrow(/nije na dostavi/i);
      await db.query("rollback to savepoint a");
      expect((await zalihaObjekta(db)).get("Topla čokolada")).toBe(5);
    });
  });

  it("primljen zahtjev se ne može ni odobriti, ni odbiti, ni izdati ponovo", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await potvrdi(db, id);
      await kao(db, s.magacioner);
      await db.query("savepoint a");
      await expect(odobri(db, id)).rejects.toThrow(/već obrađen/i);
      await db.query("rollback to savepoint a");
      await expect(db.query("select magacin.izdaj_zahtjev($1)", [id])).rejects.toThrow(/nije odobren/i);
    });
  });

  it("objekat drugog objekta ne može potvrditi tuđi zahtjev", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.kuhinjaOsoblje);
      await expect(potvrdi(db, id)).rejects.toThrow(/nemate pravo|ne postoji/i);
    });
  });

  it("magacioner i menadžer ne potvrđuju primljeno umjesto objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await kao(db, s.magacioner);
      await db.query("savepoint a");
      await expect(potvrdi(db, id)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.sef);
      await expect(potvrdi(db, id)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("neprijavljen ne može potvrditi", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await expect(potvrdi(db, id)).rejects.toThrow();
    });
  });
});

describe("razlike pri prijemu za magacionera i menadžera", () => {
  const razlike = async (db: Client) => (await db.query("select * from magacin.razlike_pri_prijemu()")).rows;

  it("pokazuju šta je izdato, šta primljeno, razliku, njenu vrijednost i ko je potvrdio", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 3 }]);
      await kao(db, s.magacioner);
      const r = await razlike(db);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ zahtjev_id: id, objekat: "ŠANK HOTEL", artikal: "Topla čokolada", mjera: "kg", primio: "Šank osoblje" });
      expect(Number(r[0].izdano)).toBe(5);
      expect(Number(r[0].primljeno)).toBe(3);
      expect(Number(r[0].razlika)).toBe(-2);
      expect(Number(r[0].vrijednost_razlike)).toBe(-8);
    });
  });

  it("zahtjevi bez razlike se ne pojavljuju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      await potvrdi(db, id);
      await kao(db, s.sef);
      expect(await razlike(db)).toHaveLength(0);
    });
  });

  it("menadžer vidi razlike", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      const id = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const [st] = (await jedan(db, id)).stavke;
      await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 4 }]);
      await kao(db, s.sef);
      expect(await razlike(db)).toHaveLength(1);
    });
  });

  it("objekat ne vidi pregled razlika (sadrži cijene)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sankOsoblje);
      await expect(razlike(db)).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("najnovije razlike su prve", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await naStanje(db, s, s.cokolada, 20, 4);
      await naStanje(db, s, s.mlijeko, 20, 1);
      const a = await naDostavi(db, s, [{ artikal_id: s.cokolada, kolicina: 5 }]);
      const b = await naDostavi(db, s, [{ artikal_id: s.mlijeko, kolicina: 5 }]);
      for (const id of [a, b]) {
        const [st] = (await jedan(db, id)).stavke;
        await potvrdi(db, id, [{ stavka_id: st.id, kolicina: 1 }]);
      }
      await kao(db, s.magacioner);
      expect((await razlike(db)).map((r) => r.zahtjev_id)).toEqual([b, a]);
    });
  });
});
