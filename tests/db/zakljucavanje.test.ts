import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKao, prijaviKaoNeprijavljen, uTransakciji } from "./helpers";

/** Broji pogrešan pokušaj (poziva ga samo server, s pravima service_role; ovdje kao vlasnik baze). */
async function pogresan(db: Client, id: string) {
  const { rows } = await db.query("select * from magacin.zabiljezi_neuspjeli_pokusaj($1)", [id]);
  return { neuspjesnih: Number(rows[0].neuspjesnih), zakljucanDo: rows[0].zakljucan_do as Date | null };
}
const zakljucanDo = async (db: Client, id: string) =>
  (await db.query("select magacin.provjeri_zakljucavanje($1) as do", [id])).rows[0].do as Date | null;
const uspjesna = (db: Client, id: string) => db.query("select magacin.zabiljezi_uspjesnu_prijavu($1)", [id]);

/** Red iz vremena prije ukidanja: zaključan račun (pregled i otključavanje i dalje rade). */
const zakljucaj = (db: Client, id: string) =>
  db.query(
    "insert into magacin.pokusaj_prijave (korisnik_id, neuspjesnih, zadnji_pokusaj, zakljucan_do) values ($1, 5, now(), now() + interval '15 minutes')",
    [id],
  );

async function korisnik(db: Client, ime = "Amra") {
  return napraviKorisnika(db, { ime, uloga: "magacioner" });
}

describe("zaključavanje računa je ukinuto", () => {
  it("koliko god pogrešnih pokušaja bilo, račun se nikad ne zaključava", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 0; i < 20; i++) expect(await pogresan(db, id)).toEqual({ neuspjesnih: 0, zakljucanDo: null });
      expect(await zakljucanDo(db, id)).toBeNull();
      const { rows } = await db.query("select count(*)::int as n from magacin.pokusaj_prijave where korisnik_id = $1", [id]);
      expect(rows[0].n).toBe(0);
    });
  });

  it("uspješna prijava i dalje prolazi bez greške", async () => {
    await uTransakciji(async (db) => {
      await uspjesna(db, await korisnik(db));
    });
  });

  it("nepoznat račun se ignoriše bez greške", async () => {
    await uTransakciji(async (db) => {
      expect(await pogresan(db, "00000000-0000-4000-8000-000000000000")).toEqual({ neuspjesnih: 0, zakljucanDo: null });
      expect(await zakljucanDo(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });
});

describe("pregled i otključavanje za menadžera", () => {
  const zakljucani = async (db: Client) => (await db.query("select * from magacin.zakljucani_racuni()")).rows;

  it("menadžer vidi zaključane račune s imenom, brojem pokušaja i do kad", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      await zakljucaj(db, id);
      const sead = await korisnik(db, "Sead");
      await db.query("insert into magacin.pokusaj_prijave (korisnik_id, neuspjesnih, zadnji_pokusaj) values ($1, 1, now())", [sead]); // nije zaključan
      await prijaviKao(db, sef);
      const r = await zakljucani(db);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ korisnik_id: id, ime: "Amra" });
      expect(Number(r[0].neuspjesnih)).toBe(5);
      expect(r[0].zakljucan_do).not.toBeNull();
    });
  });

  it("zaključavanje se vidi i u pregledu korisnika", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      await zakljucaj(db, id);
      await prijaviKao(db, sef);
      const k = (await db.query("select * from magacin.korisnici_pregled()")).rows.find((r) => r.id === id);
      expect(k.zakljucan_do).not.toBeNull();
    });
  });

  it("menadžer može odmah otključati račun, i brojač kreće ispočetka", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      await zakljucaj(db, id);
      await prijaviKao(db, sef);
      await db.query("select magacin.otkljucaj_korisnika($1)", [id]);
      await db.query("reset role");
      await prijaviKao(db, sef);
      expect(await zakljucani(db)).toHaveLength(0);
    });
  });

  it("otključavanje i pregled su samo za menadžera", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const mag = await napraviKorisnika(db, { ime: "Magacioner", uloga: "magacioner" });
      await zakljucaj(db, id);
      await prijaviKao(db, mag);
      await db.query("savepoint a");
      await expect(db.query("select magacin.otkljucaj_korisnika($1)", [id])).rejects.toThrow(/nemate pravo/i);
      await db.query("rollback to savepoint a");
      await expect(zakljucani(db)).rejects.toThrow(/nemate pravo/i);
    });
  });
});

describe("brojač se ne može mijenjati izvana", () => {
  it("prijavljeni korisnici i neprijavljeni ne mogu pozvati funkcije za brojanje (samo server)", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const mag = await napraviKorisnika(db, { ime: "Magacioner", uloga: "magacioner" });
      const pokusaj = async () => {
        for (const upit of [
          "select magacin.provjeri_zakljucavanje($1)",
          "select * from magacin.zabiljezi_neuspjeli_pokusaj($1)",
          "select magacin.zabiljezi_uspjesnu_prijavu($1)",
        ]) {
          await db.query("savepoint a");
          await expect(db.query(upit, [id])).rejects.toThrow(/permission denied/i);
          await db.query("rollback to savepoint a");
        }
      };
      await prijaviKao(db, mag);
      await pokusaj();
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await pokusaj();
    });
  });

  it("tabela s brojačem nije čitljiva ni upisiva za prijavljene korisnike", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const mag = await napraviKorisnika(db, { ime: "Magacioner", uloga: "magacioner" });
      await prijaviKao(db, mag);
      await expect(db.query("select * from magacin.pokusaj_prijave")).rejects.toThrow(/permission denied/i);
    });
  });

  it("server (service_role) smije koristiti funkcije za brojanje", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      await db.query("set local role service_role");
      const { rows } = await db.query("select * from magacin.zabiljezi_neuspjeli_pokusaj($1)", [id]);
      expect(Number(rows[0].neuspjesnih)).toBe(0);
      expect((await db.query("select magacin.provjeri_zakljucavanje($1) as do", [id])).rows[0].do).toBeNull();
      await db.query("select magacin.zabiljezi_uspjesnu_prijavu($1)", [id]);
    });
  });
});

describe("traženje računa po e-adresi (za prijavu menadžera)", () => {
  it("vraća račun samo serveru", async () => {
    await uTransakciji(async (db) => {
      const { rows } = await db.query(
        "insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'sef@magacin.local', 'authenticated', 'authenticated') returning id",
      );
      await db.query("insert into magacin.korisnik (id, ime, uloga) values ($1, 'Šef', 'menadzer')", [rows[0].id]);
      expect((await db.query("select magacin.korisnik_po_emailu('SEF@magacin.local') as id")).rows[0].id).toBe(rows[0].id);
      expect((await db.query("select magacin.korisnik_po_emailu('nema@magacin.local') as id")).rows[0].id).toBeNull();
      const mag = await napraviKorisnika(db, { ime: "Magacioner", uloga: "magacioner" });
      await prijaviKao(db, mag);
      await expect(db.query("select magacin.korisnik_po_emailu('sef@magacin.local')")).rejects.toThrow(/permission denied/i);
    });
  });
});
