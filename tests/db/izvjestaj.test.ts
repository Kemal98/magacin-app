import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { uTransakciji } from "./helpers";
import { kao, naDostavi, pripremi, smjene, uZalihuObjekta, zatvori } from "./svijet";

type Red = Record<string, string | number | null>;

/** Lokalni datum (Sarajevo), kako ga vidi izvještaj. */
async function danas(db: Client, pomak = 0): Promise<string> {
  const { rows } = await db.query("select ((now() at time zone 'Europe/Sarajevo')::date + $1::int)::text as d", [pomak]);
  return rows[0].d;
}

async function izvjestaj(db: Client, od: string, do_: string, objekat: string | null = null): Promise<Red[]> {
  const { rows } = await db.query("select * from magacin.izvjestaj_objekata($1::date, $2::date, $3)", [od, do_, objekat]);
  return rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])),
  ) as Red[];
}

const trazi = (redovi: Red[], objekat: string, artikal: string) =>
  redovi.find((r) => r.objekat === objekat && r.artikal === artikal) as Red;

async function cijeloVrijeme(db: Client, objekat: string | null = null) {
  return izvjestaj(db, await danas(db, -1), await danas(db, 1), objekat);
}

describe("potrošnja i trošak po objektu i artiklu", () => {
  it("potrošnja i trošak dolaze iz zatvorenih smjena, po cijeni izdatog", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r).toMatchObject({ potroseno: 3, trosak_potrosnje: 12, izuzeci: 0, mjera: "kg" });
    });
  });

  it("izuzeci su odvojeni od potrošnje, s vlastitim troškom", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await db.query("select magacin.dodaj_izuzetak($1, 1, 'Razbijeno')", [s.cokolada]);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 6 }]);
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r).toMatchObject({ potroseno: 3, trosak_potrosnje: 12, izuzeci: 1, trosak_izuzetaka: 4 });
    });
  });

  it("brojke se slažu sa zabilježenim smjenama: trošak potrošnje i izuzetaka", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await uZalihuObjekta(db, s, s.mlijeko, 20, 1.5);
      await db.query("select magacin.dodaj_izuzetak($1, 2, 'Proliveno')", [s.mlijeko]);
      await zatvori(db, "Emir", [
        { artikal_id: s.cokolada, zavrsno: 7 },
        { artikal_id: s.mlijeko, zavrsno: 12 },
      ]);
      await uZalihuObjekta(db, s, s.cokolada, 5, 6);
      await zatvori(db, "Sead", [
        { artikal_id: s.cokolada, zavrsno: 9 },
        { artikal_id: s.mlijeko, zavrsno: 11 },
      ]);
      await kao(db, s.sef);
      const redovi = await cijeloVrijeme(db);
      const trosakIzvjestaj = redovi.reduce((z, r) => z + Number(r.trosak_potrosnje), 0);
      const izuzeciIzvjestaj = redovi.reduce((z, r) => z + Number(r.trosak_izuzetaka), 0);
      const zatvorene = await smjene(db, s.sank);
      const trosakSmjena = zatvorene.reduce((z, x) => z + Number(x.trosak), 0);
      const izuzeciSmjena = zatvorene.reduce((z, x) => z + Number(x.trosak_izuzetaka), 0);
      expect(trosakIzvjestaj).toBeCloseTo(trosakSmjena, 8);
      expect(izuzeciIzvjestaj).toBeCloseTo(izuzeciSmjena, 8);
      expect(trosakIzvjestaj).toBeGreaterThan(0);
      expect(izuzeciIzvjestaj).toBeCloseTo(3, 8); // 2 l × 1,5 KM
    });
  });

  it("više smjena istog artikla se sabira", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 8 }]); // potrošeno 2
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 5 }]); // potrošeno 3
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r).toMatchObject({ potroseno: 5, trosak_potrosnje: 20 });
    });
  });

  it("kasnija promjena cijene u magacinu ne mijenja izvještaj", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
        s.dobavljac,
        JSON.stringify([{ artikal_id: s.cokolada, kolicina: 100, cijena: 50 }]),
      ]);
      await kao(db, s.sef);
      expect(trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada").trosak_potrosnje).toBe(12);
    });
  });
});

describe("izbor perioda i objekta", () => {
  it("period koji obuhvata danas sadrži podatke, a jučerašnji ne", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      const d = await danas(db);
      expect(await izvjestaj(db, d, d)).toHaveLength(1);
      const jucer = await danas(db, -1);
      expect(await izvjestaj(db, jucer, jucer)).toHaveLength(0);
      const sutra = await danas(db, 1);
      expect(await izvjestaj(db, sutra, sutra)).toHaveLength(0);
    });
  });

  it("filtrira po objektu", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      expect(await cijeloVrijeme(db, s.kuhinja)).toHaveLength(0);
      expect((await cijeloVrijeme(db, s.sank)).length).toBeGreaterThan(0);
    });
  });

  it("početak perioda ne smije biti poslije kraja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await expect(izvjestaj(db, "2026-09-10", "2026-09-01")).rejects.toThrow(/period/i);
    });
  });

  it("redovi bez ikakvog kretanja u periodu se ne prikazuju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      expect(await cijeloVrijeme(db)).toHaveLength(0);
    });
  });
});

describe("izdato, potrošeno i zaliha objekta", () => {
  it("prikazuje izdato, potrošeno i razliku (izdato − potrošeno), uz zalihu objekta", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r).toMatchObject({ izdato: 10, potroseno: 3, razlika: 7, zaliha_sada: 7, vrijednost_izdatog: 40 });
    });
  });

  it("razlika je izdato minus potrošeno i u periodu s više izdavanja", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await uZalihuObjekta(db, s, s.cokolada, 6, 5);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 9 }]); // potrošeno 7
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r.izdato).toBe(16);
      expect(r.potroseno).toBe(7);
      expect(r.razlika).toBe(9);
      expect(r.razlika).toBe(Number(r.izdato) - Number(r.potroseno));
    });
  });

  it("manjak pri prijemu se prikazuje odvojeno, a poništeno izdavanje se ne računa kao izdato", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      // Izdato 5, primljeno 3 (manjak 2)
      await kao(db, s.magacioner);
      await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [s.dobavljac, JSON.stringify([{ artikal_id: s.mlijeko, kolicina: 8, cijena: 1 }])]);
      await kao(db, s.sankOsoblje);
      const { rows } = await db.query("select magacin.posalji_zahtjev($1::jsonb) as id", [JSON.stringify([{ artikal_id: s.mlijeko, kolicina: 5 }])]);
      await kao(db, s.magacioner);
      await db.query("select magacin.odobri_zahtjev($1)", [rows[0].id]);
      await db.query("select magacin.izdaj_zahtjev($1)", [rows[0].id]);
      await kao(db, s.sankOsoblje);
      const st = (await db.query("select * from magacin.zahtjevi()")).rows.find((z) => z.id === rows[0].id).stavke[0];
      await db.query("select magacin.potvrdi_primljeno($1, $2::jsonb)", [rows[0].id, JSON.stringify([{ stavka_id: st.id, kolicina: 3 }])]);
      // Ovo izdavanje poništavamo
      await kao(db, s.magacioner);
      const poništen = await naDostavi(db, s, s.kafa, 4, 2);
      await kao(db, s.sef);
      await db.query("select magacin.storniraj_izdavanje($1, 'Greška')", [poništen]);
      const redovi = await cijeloVrijeme(db);
      const mlijeko = trazi(redovi, "ŠANK HOTEL", "Mlijeko");
      expect(mlijeko).toMatchObject({ izdato: 5, manjak: 2, zaliha_sada: 3 });
      expect(redovi.find((r) => r.artikal === "Kafa")).toBeUndefined(); // stornirano izdavanje ne postoji u izvještaju
    });
  });

  it("promjena zalihe u cijelom periodu jednaka je zalihi objekta (izdato − manjak − potrošeno − izuzeci + višak)", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await db.query("select magacin.dodaj_izuzetak($1, 1, 'Razbijeno')", [s.cokolada]);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 5 }]); // potrošeno 4
      await uZalihuObjekta(db, s, s.cokolada, 6, 4);
      await zatvori(db, "Sead", [{ artikal_id: s.cokolada, zavrsno: 13, razlog: "Dobijeno od kuhinje" }]); // 5+6=11, višak 2
      await kao(db, s.sef);
      const r = trazi(await cijeloVrijeme(db), "ŠANK HOTEL", "Topla čokolada");
      expect(r.izdato).toBe(16);
      expect(r.izuzeci).toBe(1);
      expect(r.potroseno).toBe(4);
      expect(r.visak).toBe(2);
      expect(r.promjena_zalihe).toBe(Number(r.izdato) - Number(r.manjak) - Number(r.potroseno) - Number(r.izuzeci) + Number(r.visak));
      expect(r.promjena_zalihe).toBe(r.zaliha_sada);
      expect(r.zaliha_sada).toBe(13);
    });
  });

  it("izdato u periodu koji ne obuhvata izdavanje je nula, a zaliha ostaje ista", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await uZalihuObjekta(db, s, s.cokolada, 10, 4);
      await zatvori(db, "Emir", [{ artikal_id: s.cokolada, zavrsno: 7 }]);
      await kao(db, s.sef);
      // Sutrašnji period: nema kretanja, pa nema ni redova.
      const sutra = await danas(db, 1);
      expect(await izvjestaj(db, sutra, sutra)).toHaveLength(0);
    });
  });
});

describe("ko smije gledati izvještaje", () => {
  it("menadžer smije", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.sef);
      await cijeloVrijeme(db);
    });
  });

  it("magacioner i objekat ne smiju", async () => {
    await uTransakciji(async (db) => {
      const s = await pripremi(db);
      await kao(db, s.magacioner);
      await db.query("savepoint a");
      await expect(cijeloVrijeme(db)).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await kao(db, s.sankOsoblje);
      await expect(cijeloVrijeme(db)).rejects.toThrow(/nemate pravo/i);
    });
  });
});
