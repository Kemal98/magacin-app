import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { poveziLokalno } from "./helpers";

/**
 * Paralelno izdavanje traži prave, potvrđene podatke i više veza istovremeno, pa ovaj test
 * ne može raditi u poništivoj transakciji. Sve što napravi ima jedinstvenu oznaku i briše se
 * samo po njoj, pa razvojni podaci ostaju netaknuti.
 */
const oznaka = `ZZ-PARALELNO-${randomUUID().slice(0, 8)}`;

let admin: Client;
const id = { artikal: randomUUID(), objekat: randomUUID(), magacioner: randomUUID(), osoblje: randomUUID() };
const zahtjevi: string[] = [];

async function napraviKorisnika(uid: string, ime: string, uloga: string, objekat: string | null) {
  await admin.query(
    "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
    [uid, `${uid}@test.local`],
  );
  await admin.query("insert into magacin.korisnik (id, ime, uloga, objekat_id) values ($1, $2, $3, $4)", [
    uid,
    ime,
    uloga,
    objekat,
  ]);
}

/** Odobren zahtjev od `kolicina` osnovnih mjera. */
async function odobrenZahtjev(kolicina: number): Promise<string> {
  const zid = randomUUID();
  await admin.query(
    "insert into magacin.zahtjev (id, objekat_id, korisnik_id, status, obradio_id, odluka_vrijeme) values ($1, $2, $3, 'odobren', $4, now())",
    [zid, id.objekat, id.osoblje, id.magacioner],
  );
  await admin.query(
    `insert into magacin.zahtjev_stavka
       (zahtjev_id, artikal_id, trazena_kolicina, trazena_osnovna, odobrena_kolicina, odobrena_osnovna)
     values ($1, $2, $3, $3, $3, $3)`,
    [zid, id.artikal, kolicina],
  );
  zahtjevi.push(zid);
  return zid;
}

/** Izdaje kao magacioner u vlastitoj vezi i transakciji; `zadrzi` drži transakciju otvorenom prije potvrde. */
async function izdaj(zahtjev: string, zadrzi = 0): Promise<{ uspjelo: boolean; poruka?: string }> {
  const db = await poveziLokalno();
  try {
    await db.query("begin");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id.magacioner, role: "authenticated" }),
    ]);
    await db.query("set local role authenticated");
    await db.query("select magacin.izdaj_zahtjev($1)", [zahtjev]);
    if (zadrzi) await db.query("select pg_sleep($1)", [zadrzi]);
    await db.query("commit");
    return { uspjelo: true };
  } catch (e) {
    await db.query("rollback").catch(() => {});
    return { uspjelo: false, poruka: e instanceof Error ? e.message : String(e) };
  } finally {
    await db.end().catch(() => {});
  }
}

async function stanje(): Promise<number> {
  const { rows } = await admin.query("select kolicina from magacin.zaliha_magacina where artikal_id = $1", [id.artikal]);
  return Number(rows[0].kolicina);
}

async function zalihaObjekta(): Promise<number> {
  const { rows } = await admin.query(
    "select coalesce(sum(kolicina), 0) as k from magacin.zaliha_objekta where objekat_id = $1",
    [id.objekat],
  );
  return Number(rows[0].k);
}

async function pocisti() {
  await admin.query("begin");
  try {
    // Knjige su nepromjenjive; čišćenje vlastitih probnih podataka zaobilazi okidače.
    await admin.query("set local session_replication_role = replica");
    await admin.query("delete from magacin.kretanje_objekta where objekat_id = $1", [id.objekat]);
    await admin.query("delete from magacin.kretanje_magacina where artikal_id = $1", [id.artikal]);
    await admin.query("delete from magacin.zaliha_objekta where objekat_id = $1", [id.objekat]);
    await admin.query("delete from magacin.zaliha_magacina where artikal_id = $1", [id.artikal]);
    await admin.query("delete from magacin.zahtjev_stavka where zahtjev_id = any ($1::uuid[])", [zahtjevi]);
    await admin.query("delete from magacin.zahtjev where id = any ($1::uuid[])", [zahtjevi]);
    await admin.query("delete from magacin.objekat_artikal where objekat_id = $1", [id.objekat]);
    await admin.query("delete from magacin.korisnik where id = any ($1::uuid[])", [[id.magacioner, id.osoblje]]);
    await admin.query("delete from auth.users where id = any ($1::uuid[])", [[id.magacioner, id.osoblje]]);
    await admin.query("delete from magacin.artikal where id = $1", [id.artikal]);
    await admin.query("delete from magacin.objekat where id = $1", [id.objekat]);
    await admin.query("commit");
  } catch (e) {
    await admin.query("rollback").catch(() => {});
    throw e;
  }
}

beforeAll(async () => {
  admin = await poveziLokalno();
  await admin.query("insert into magacin.objekat (id, naziv) values ($1, $2)", [id.objekat, oznaka]);
  await admin.query("insert into magacin.artikal (id, naziv, mjera, vrsta) values ($1, $2, 'kg', 'prehrana')", [id.artikal, oznaka]);
  await napraviKorisnika(id.magacioner, `${oznaka} magacioner`, "magacioner", null);
  await napraviKorisnika(id.osoblje, `${oznaka} osoblje`, "objekat", id.objekat);
});

afterAll(async () => {
  try {
    await pocisti();
  } finally {
    await admin?.end();
  }
});

describe("paralelno izdavanje istog artikla", () => {
  it("drugo izdavanje čeka prvo i ne može preći stanje", async () => {
    await admin.query("delete from magacin.zaliha_magacina where artikal_id = $1", [id.artikal]);
    await admin.query("insert into magacin.zaliha_magacina (artikal_id, kolicina, prosjecna_cijena) values ($1, 10, 5)", [id.artikal]);
    const a = await odobrenZahtjev(6);
    const b = await odobrenZahtjev(6);

    // Prvo izdavanje drži transakciju otvorenom; drugo počinje dok je prvo još nepotvrđeno.
    const prvo = izdaj(a, 0.6);
    await new Promise((r) => setTimeout(r, 150));
    const drugo = izdaj(b);
    const [ra, rb] = await Promise.all([prvo, drugo]);

    expect(ra.uspjelo).toBe(true);
    expect(rb.uspjelo).toBe(false);
    expect(rb.poruka).toMatch(/nema dovoljno/i);
    expect(await stanje()).toBe(4);
  });

  it("više istovremenih izdavanja: uspije samo koliko stanje dozvoljava", async () => {
    await admin.query("update magacin.zaliha_magacina set kolicina = 10 where artikal_id = $1", [id.artikal]);
    const ids = await Promise.all([1, 2, 3, 4, 5, 6].map(() => odobrenZahtjev(3)));
    const rezultati = await Promise.all(ids.map((z) => izdaj(z)));

    const uspjela = rezultati.filter((r) => r.uspjelo).length;
    expect(uspjela).toBe(3); // 3 × 3 = 9 od 10; četvrto ne stane
    expect(await stanje()).toBe(1);
    expect(rezultati.filter((r) => !r.uspjelo).every((r) => /nema dovoljno/i.test(r.poruka ?? ""))).toBe(true);
  });

  it("zaliha objekta je tačno zbir onoga što je izdato", async () => {
    // Iz prethodnih testova: 6 + 9 izdato objektu (ostatak ovog objekta je samo naš).
    expect(await zalihaObjekta()).toBe(15);
  });

  it("ukupno skinuto s magacina jednako je ukupno primljeno u objekat", async () => {
    const { rows } = await admin.query(
      "select coalesce(sum(kolicina), 0) as k from magacin.kretanje_magacina where artikal_id = $1 and vrsta = 'izdavanje'",
      [id.artikal],
    );
    expect(Number(rows[0].k)).toBe(-15);
  });
});
