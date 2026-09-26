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

const minuta = (od: Date, do_: Date) => (do_.getTime() - od.getTime()) / 60_000;

async function korisnik(db: Client, ime = "Amra") {
  return napraviKorisnika(db, { ime, uloga: "magacioner" });
}

describe("zaključavanje računa poslije pogrešnih PIN-ova", () => {
  it("račun bez pogrešnih pokušaja nije zaključan", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      expect(await zakljucanDo(db, id)).toBeNull();
    });
  });

  it("četiri pogrešna pokušaja ne zaključavaju, peti zaključava na 1 minut", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 1; i <= 4; i++) {
        const r = await pogresan(db, id);
        expect(r).toEqual({ neuspjesnih: i, zakljucanDo: null });
      }
      expect(await zakljucanDo(db, id)).toBeNull();
      const peti = await pogresan(db, id);
      expect(peti.neuspjesnih).toBe(5);
      expect(peti.zakljucanDo).not.toBeNull();
      expect(minuta(new Date(), peti.zakljucanDo!)).toBeGreaterThan(0.9);
      expect(minuta(new Date(), peti.zakljucanDo!)).toBeLessThanOrEqual(1.1);
      expect(await zakljucanDo(db, id)).not.toBeNull();
    });
  });

  it("dok je račun zaključan, novi pokušaji ne produžavaju zaključavanje", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 0; i < 5; i++) await pogresan(db, id);
      const prvo = (await zakljucanDo(db, id))!;
      const opet = await pogresan(db, id);
      expect(opet.zakljucanDo!.getTime()).toBe(prvo.getTime());
      expect(opet.neuspjesnih).toBe(5);
    });
  });

  it("uspješna prijava poništava brojač pogrešnih pokušaja", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 0; i < 3; i++) await pogresan(db, id);
      await uspjesna(db, id);
      // Poslije poništavanja, četiri nova pogrešna pokušaja još ne zaključavaju.
      for (let i = 1; i <= 4; i++) expect((await pogresan(db, id)).neuspjesnih).toBe(i);
      expect(await zakljucanDo(db, id)).toBeNull();
    });
  });

  it("po isteku zaključavanja račun je ponovo slobodan, a brojanje kreće ispočetka", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 0; i < 5; i++) await pogresan(db, id);
      expect(await zakljucanDo(db, id)).not.toBeNull();
      await db.query("update magacin.pokusaj_prijave set zakljucan_do = clock_timestamp() - interval '1 minute' where korisnik_id = $1", [id]);
      expect(await zakljucanDo(db, id)).toBeNull();
      expect(await pogresan(db, id)).toEqual({ neuspjesnih: 1, zakljucanDo: null });
    });
  });

  it("stari pogrešni pokušaji (više od 10 minuta) se ne sabiraju s novim", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db);
      for (let i = 0; i < 4; i++) await pogresan(db, id);
      await db.query("update magacin.pokusaj_prijave set zadnji_pokusaj = clock_timestamp() - interval '11 minutes' where korisnik_id = $1", [id]);
      expect(await pogresan(db, id)).toEqual({ neuspjesnih: 1, zakljucanDo: null });
    });
  });

  it("računi se zaključavaju svaki za sebe", async () => {
    await uTransakciji(async (db) => {
      const a = await korisnik(db, "Amra");
      const b = await korisnik(db, "Sead");
      for (let i = 0; i < 5; i++) await pogresan(db, a);
      expect(await zakljucanDo(db, a)).not.toBeNull();
      expect(await zakljucanDo(db, b)).toBeNull();
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
      for (let i = 0; i < 5; i++) await pogresan(db, id);
      await pogresan(db, (await korisnik(db, "Sead"))); // jedan pokušaj: nije zaključan
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
      for (let i = 0; i < 5; i++) await pogresan(db, id);
      await prijaviKao(db, sef);
      const k = (await db.query("select * from magacin.korisnici_pregled()")).rows.find((r) => r.id === id);
      expect(k.zakljucan_do).not.toBeNull();
    });
  });

  it("menadžer može odmah otključati račun, i brojač kreće ispočetka", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      for (let i = 0; i < 5; i++) await pogresan(db, id);
      await prijaviKao(db, sef);
      await db.query("select magacin.otkljucaj_korisnika($1)", [id]);
      await db.query("reset role");
      expect(await zakljucanDo(db, id)).toBeNull();
      expect(await pogresan(db, id)).toEqual({ neuspjesnih: 1, zakljucanDo: null });
      await prijaviKao(db, sef);
      expect(await zakljucani(db)).toHaveLength(0);
    });
  });

  it("otključavanje i pregled su samo za menadžera", async () => {
    await uTransakciji(async (db) => {
      const id = await korisnik(db, "Amra");
      const mag = await napraviKorisnika(db, { ime: "Magacioner", uloga: "magacioner" });
      for (let i = 0; i < 5; i++) await pogresan(db, id);
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
      await pogresan(db, id);
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
      expect(Number(rows[0].neuspjesnih)).toBe(1);
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
