import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { napraviKorisnika, prijaviKao, prijaviKaoNeprijavljen, uTransakciji } from "./helpers";

/** Račun u Auth (kao što ga pravi administratorski API), bez zapisa u magacinu. */
async function racun(db: Client, email = `${randomUUID()}@korisnik.magacin.local`): Promise<string> {
  const { rows } = await db.query(
    "insert into auth.users (id, email, aud, role) values (gen_random_uuid(), $1, 'authenticated', 'authenticated') returning id",
    [email],
  );
  return rows[0].id;
}

async function pripremi(db: Client) {
  const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
  await prijaviKao(db, sef);
  const objekat = (await db.query("select magacin.sacuvaj_objekat(null, 'ŠANK HOTEL') as id")).rows[0].id as string;
  const kuhinja = (await db.query("select magacin.sacuvaj_objekat(null, 'KUHINJA') as id")).rows[0].id as string;
  await db.query("reset role");
  return { sef, objekat, kuhinja };
}

const dodaj = (db: Client, id: string, ime: string, uloga: string, objekat: string | null = null) =>
  db.query("select magacin.dodaj_korisnika($1, $2, $3::magacin.uloga, $4)", [id, ime, uloga, objekat]);

const pregled = async (db: Client) => (await db.query("select * from magacin.korisnici_pregled()")).rows;

describe("dodavanje korisnika", () => {
  it("menadžer dodaje magacionera s imenom i ulogom", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Amra Hodžić", "magacioner");
      const k = (await pregled(db)).find((r) => r.id === id);
      expect(k).toMatchObject({ ime: "Amra Hodžić", uloga: "magacioner", aktivan: true, objekat: null });
    });
  });

  it("osoblje objekta se veže za objekat iz šifrarnika", async () => {
    await uTransakciji(async (db) => {
      const { sef, objekat } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Šank osoblje", "objekat", objekat);
      expect((await pregled(db)).find((r) => r.id === id)).toMatchObject({ uloga: "objekat", objekat: "ŠANK HOTEL" });
    });
  });

  it("osoblje objekta bez objekta se odbija", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await expect(dodaj(db, id, "Bez objekta", "objekat")).rejects.toThrow(/objekat/i);
    });
  });

  it("magacioner i menadžer ne mogu imati objekat", async () => {
    await uTransakciji(async (db) => {
      const { sef, objekat } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await expect(dodaj(db, id, "Amra", "magacioner", objekat)).rejects.toThrow(/objekat/i);
    });
  });

  it("isključen objekat se ne može dodijeliti", async () => {
    await uTransakciji(async (db) => {
      const { sef, objekat } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await db.query("select magacin.postavi_aktivnost_objekta($1, false)", [objekat]);
      await expect(dodaj(db, id, "Osoblje", "objekat", objekat)).rejects.toThrow(/objekat/i);
    });
  });

  it("dodaje drugog menadžera", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db, "drugi@magacin.local");
      await prijaviKao(db, sef);
      await dodaj(db, id, "Drugi menadžer", "menadzer");
      const k = (await pregled(db)).find((r) => r.id === id);
      expect(k).toMatchObject({ uloga: "menadzer", email: "drugi@magacin.local" });
    });
  });

  it("ime je obavezno", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await expect(dodaj(db, id, "   ", "magacioner")).rejects.toThrow(/ime/i);
    });
  });

  it("ime je jedinstveno bez obzira na velika slova i razmake", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const a = await racun(db);
      const b = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, a, "Amra Hodžić", "magacioner");
      await expect(dodaj(db, b, "  amra hodžić ", "magacioner")).rejects.toThrow(/već postoji/i);
    });
  });

  it("račun mora postojati u Auth", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      await prijaviKao(db, sef);
      await expect(dodaj(db, "00000000-0000-4000-8000-000000000000", "Niko", "magacioner")).rejects.toThrow(/račun/i);
    });
  });

  it("isti račun se ne može dodati dvaput", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Amra", "magacioner");
      await expect(dodaj(db, id, "Amra druga", "magacioner")).rejects.toThrow(/već/i);
    });
  });
});

describe("izmjena i isključivanje", () => {
  it("menadžer mijenja ime osoblja objekta i objekat", async () => {
    await uTransakciji(async (db) => {
      const { sef, objekat, kuhinja } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Šank osoblje", "objekat", objekat);
      await db.query("select magacin.izmijeni_korisnika($1, 'Kuhinja osoblje', $2)", [id, kuhinja]);
      expect((await pregled(db)).find((r) => r.id === id)).toMatchObject({ ime: "Kuhinja osoblje", objekat: "KUHINJA" });
    });
  });

  it("izmjena imena ne smije se sudariti s drugim imenom", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const a = await racun(db);
      const b = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, a, "Amra", "magacioner");
      await dodaj(db, b, "Sead", "magacioner");
      await db.query("savepoint a");
      await expect(db.query("select magacin.izmijeni_korisnika($1, 'AMRA', null)", [b])).rejects.toThrow(/već postoji/i);
      await db.query("rollback to savepoint a");
      await db.query("select magacin.izmijeni_korisnika($1, 'Sead Hodžić', null)", [b]); // isto ime sebi je ok
    });
  });

  it("nepostojeći korisnik", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      await prijaviKao(db, sef);
      await expect(db.query("select magacin.izmijeni_korisnika('00000000-0000-4000-8000-000000000000', 'X', null)")).rejects.toThrow(/korisnik/i);
    });
  });

  it("isključen korisnik nestaje s ekrana za prijavu i ne može raditi", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Amra", "magacioner");
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      expect((await db.query("select * from magacin.korisnici_za_prijavu()")).rows.map((r) => r.ime)).toContain("Amra");
      await db.query("reset role");
      await prijaviKao(db, sef);
      await db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [id]);
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      expect((await db.query("select * from magacin.korisnici_za_prijavu()")).rows.map((r) => r.ime)).not.toContain("Amra");
      await db.query("reset role");
      await prijaviKao(db, id);
      await expect(db.query("select * from magacin.trenutni_korisnik()")).rejects.toThrow(/nije prijavljen/i);
    });
  });

  it("isključeni korisnik se može ponovo uključiti", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Amra", "magacioner");
      await db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [id]);
      await db.query("select magacin.postavi_aktivnost_korisnika($1, true)", [id]);
      expect((await pregled(db)).find((r) => r.id === id)?.aktivan).toBe(true);
    });
  });

  it("menadžer ne može isključiti samog sebe", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      await prijaviKao(db, sef);
      await expect(db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [sef])).rejects.toThrow(/sebe/i);
    });
  });

  it("nikad se ne može isključiti zadnji aktivni menadžer", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const drugi = await napraviKorisnika(db, { ime: "Drugi šef", uloga: "menadzer" });
      await prijaviKao(db, sef);
      await db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [drugi]); // ostaje jedan
      await expect(db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [sef])).rejects.toThrow();
    });
  });

  it("promjene se bilježe samo za postojeće osobe", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      await prijaviKao(db, sef);
      await expect(db.query("select magacin.postavi_aktivnost_korisnika('00000000-0000-4000-8000-000000000000', false)")).rejects.toThrow(/korisnik/i);
    });
  });
});

describe("ko smije upravljati korisnicima", () => {
  it("magacioner, objekat i neprijavljen ne smiju ništa od toga", async () => {
    await uTransakciji(async (db) => {
      const { objekat } = await pripremi(db);
      const nova = await racun(db);
      const meta = await napraviKorisnika(db, { ime: "Meta", uloga: "magacioner" });
      const mag = await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      const osoblje = await napraviKorisnika(db, { ime: "Osoblje", uloga: "objekat", objekatId: objekat });
      const radnje = [
        () => dodaj(db, nova, "Novi", "magacioner"),
        () => db.query("select magacin.izmijeni_korisnika($1, 'X', null)", [meta]),
        () => db.query("select magacin.postavi_aktivnost_korisnika($1, false)", [meta]),
        () => pregled(db),
      ];
      const pokusaj = async () => {
        for (const radnja of radnje) {
          await db.query("savepoint a");
          await expect(radnja()).rejects.toThrow(/nemate pravo|prijav/i);
          await db.query("rollback to savepoint a");
        }
      };
      await prijaviKao(db, mag);
      await pokusaj();
      await db.query("reset role");
      await prijaviKao(db, osoblje);
      await pokusaj();
      await db.query("reset role");
      await prijaviKaoNeprijavljen(db);
      await pokusaj();
    });
  });

  it("pregled ne dijeli e-adrese osoblja objekta i magacionera (tehničke adrese)", async () => {
    await uTransakciji(async (db) => {
      const { sef } = await pripremi(db);
      const id = await racun(db);
      await prijaviKao(db, sef);
      await dodaj(db, id, "Amra", "magacioner");
      const k = (await pregled(db)).find((r) => r.id === id);
      expect(k?.email).toBeNull();
    });
  });
});
