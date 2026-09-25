import { describe, expect, it } from "vitest";
import {
  napraviKorisnika,
  prijaviKao,
  prijaviKaoNeprijavljen,
  uTransakciji,
} from "./helpers";

describe("prijavljena osoba i uloga", () => {
  it("trenutni_korisnik vraća ime i ulogu prijavljene osobe", async () => {
    await uTransakciji(async (db) => {
      const id = await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      await prijaviKao(db, id);
      const { rows } = await db.query("select * from magacin.trenutni_korisnik()");
      expect(rows[0]).toMatchObject({ id, ime: "Amra", uloga: "magacioner" });
    });
  });

  it("trenutni_korisnik odbija neprijavljenu osobu", async () => {
    await uTransakciji(async (db) => {
      await prijaviKaoNeprijavljen(db);
      await expect(db.query("select * from magacin.trenutni_korisnik()")).rejects.toThrow(
        /nije prijavljen/i,
      );
    });
  });

  it("trenutni_korisnik odbija isključenog korisnika", async () => {
    await uTransakciji(async (db) => {
      const id = await napraviKorisnika(db, {
        ime: "Bivši",
        uloga: "magacioner",
        aktivan: false,
      });
      await prijaviKao(db, id);
      await expect(db.query("select * from magacin.trenutni_korisnik()")).rejects.toThrow(
        /nije prijavljen/i,
      );
    });
  });
});

describe("šta koja uloga smije", () => {
  it("zahtijevaj_ulogu propušta dozvoljenu ulogu i vraća osobu", async () => {
    await uTransakciji(async (db) => {
      const id = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      await prijaviKao(db, id);
      const { rows } = await db.query(
        "select * from magacin.zahtijevaj_ulogu('menadzer')",
      );
      expect(rows[0]).toMatchObject({ id, ime: "Šef", uloga: "menadzer" });
    });
  });

  it("zahtijevaj_ulogu odbija drugu ulogu", async () => {
    await uTransakciji(async (db) => {
      const id = await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      await prijaviKao(db, id);
      await expect(
        db.query("select * from magacin.zahtijevaj_ulogu('menadzer')"),
      ).rejects.toThrow(/nemate pravo/i);
    });
  });

  it("zahtijevaj_ulogu prihvata više dozvoljenih uloga", async () => {
    await uTransakciji(async (db) => {
      const id = await napraviKorisnika(db, { ime: "Šank", uloga: "objekat" });
      await prijaviKao(db, id);
      const { rows } = await db.query(
        "select * from magacin.zahtijevaj_ulogu('objekat', 'menadzer')",
      );
      expect(rows[0].uloga).toBe("objekat");
    });
  });
});

describe("izbor imena na ekranu za prijavu", () => {
  it("neprijavljen vidi samo aktivne magacionere i osoblje objekata, bez menadžera", async () => {
    await uTransakciji(async (db) => {
      await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat" });
      await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
      await napraviKorisnika(db, { ime: "Bivši", uloga: "magacioner", aktivan: false });
      await prijaviKaoNeprijavljen(db);
      const { rows } = await db.query("select * from magacin.korisnici_za_prijavu()");
      const imena = rows.map((r) => r.ime).sort();
      expect(imena).toEqual(["Amra", "Šank osoblje"]);
      expect(Object.keys(rows[0]).sort()).toEqual(["id", "ime", "uloga"]);
    });
  });
});

describe("pristup podacima o korisnicima", () => {
  it("magacioner vidi samo sebe, a menadžer vidi sve", async () => {
    await uTransakciji(async (db) => {
      const amra = await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" });
      const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });

      await prijaviKao(db, amra);
      const kaoAmra = await db.query("select ime from magacin.korisnik");
      expect(kaoAmra.rows.map((r) => r.ime)).toEqual(["Amra"]);

      await db.query("reset role");
      await prijaviKao(db, sef);
      const kaoSef = await db.query("select ime from magacin.korisnik order by ime");
      expect(kaoSef.rows.map((r) => r.ime)).toEqual(["Amra", "Šef"]);
    });
  });
});
