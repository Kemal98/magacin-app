import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Pokreće test unutar transakcije koja se uvijek poništi, pa svaki test
 * počinje od praznog stanja i ne ostavlja tragove u bazi.
 */
export async function uTransakciji<T>(
  test: (db: Client) => Promise<T>,
): Promise<T> {
  // Testovi brišu korisnike unutar transakcije; nikad ne smiju ciljati tuđu bazu.
  const host = new URL(DB_URL).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Testovi rade samo na lokalnoj bazi, a DATABASE_URL pokazuje na ${host}`);
  }
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    // Razvojni podaci (seed, uvezeni šifrarnik, ručno probani prijemi) ne smiju uticati
    // na testove. Sve se poništava s transakcijom, pa razvojna baza ostaje netaknuta.
    // Knjiga se ne briše redom (nepromjenjiva je), pa se prazni cijela, i to prvo.
    await db.query(
      "truncate magacin.zahtjev_stavka, magacin.zahtjev, magacin.kretanje_magacina, magacin.prijem, magacin.zaliha_magacina",
    );
    await db.query("delete from auth.users");
    await db.query("delete from magacin.artikal");
    await db.query("delete from magacin.objekat");
    await db.query("delete from magacin.dobavljac");
    return await test(db);
  } finally {
    // Ako je veza pukla, poništavanje ne smije prekriti pravu grešku testa.
    await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
}

export type Uloga = "magacioner" | "objekat" | "menadzer";

/** Pravi prijavnog korisnika (Supabase Auth) i njegov zapis u šemi magacin. */
export async function napraviKorisnika(
  db: Client,
  opcije: { ime: string; uloga: Uloga; aktivan?: boolean; objekatId?: string | null },
): Promise<string> {
  const { rows } = await db.query(
    `insert into auth.users (id, email, aud, role)
     values (gen_random_uuid(), gen_random_uuid() || '@test.local', 'authenticated', 'authenticated')
     returning id`,
  );
  const id: string = rows[0].id;
  await db.query(
    `insert into magacin.korisnik (id, ime, uloga, aktivan, objekat_id) values ($1, $2, $3, $4, $5)`,
    [id, opcije.ime, opcije.uloga, opcije.aktivan ?? true, opcije.objekatId ?? null],
  );
  return id;
}

/** Ostatak transakcije radi kao prijavljena osoba (kao da je poslala zahtjev preko API-ja). */
export async function prijaviKao(db: Client, korisnikId: string) {
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: korisnikId, role: "authenticated" }),
  ]);
  await db.query("set local role authenticated");
}

/** Ostatak transakcije radi kao neprijavljen posjetilac (tablet na ekranu za prijavu). */
export async function prijaviKaoNeprijavljen(db: Client) {
  await db.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
  await db.query("set local role anon");
}
