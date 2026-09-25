import type { Client } from "pg";
import { napraviKorisnika, prijaviKao } from "./helpers";

/** Zajednički svijet za testove zahtjeva i izdavanja: šifrarnik, popisi objekata i korisnici. */
export type Svijet = {
  sank: string;
  kuhinja: string;
  kafa: string;
  kutija: string;
  cokolada: string;
  mlijeko: string;
  brasno: string;
  dobavljac: string;
  sankOsoblje: string;
  kuhinjaOsoblje: string;
  magacioner: string;
  sef: string;
};

/** Šifrarnik, popisi objekata i korisnici. Vraća se u ulogu vlasnika baze. */
export async function pripremi(db: Client): Promise<Svijet> {
  const sef = await napraviKorisnika(db, { ime: "Šef", uloga: "menadzer" });
  await prijaviKao(db, sef);
  const artikal = async (naziv: string, mjera: string, pak: unknown[] = []) =>
    (
      await db.query("select magacin.sacuvaj_artikal(null, $1, $2, '', 0, 'prehrana', $3::jsonb) as id", [
        naziv,
        mjera,
        JSON.stringify(pak),
      ])
    ).rows[0].id as string;
  const objekat = async (naziv: string) =>
    (await db.query("select magacin.sacuvaj_objekat(null, $1) as id", [naziv])).rows[0].id as string;
  const sank = await objekat("ŠANK HOTEL");
  const kuhinja = await objekat("KUHINJA");
  const kafa = await artikal("Kafa", "kg", [{ naziv: "kutija", faktor: 10 }]);
  const cokolada = await artikal("Topla čokolada", "kg");
  const mlijeko = await artikal("Mlijeko", "l");
  const brasno = await artikal("Brašno", "kg");
  const dobavljac = (await db.query("select magacin.sacuvaj_dobavljaca(null, 'Pekara') as id")).rows[0].id as string;
  const kutija = (await db.query("select id from magacin.pakovanje where artikal_id = $1", [kafa])).rows[0].id as string;
  await db.query("select magacin.postavi_artikle_objekta($1, $2::uuid[])", [sank, [kafa, cokolada, mlijeko]]);
  await db.query("select magacin.postavi_artikle_objekta($1, $2::uuid[])", [kuhinja, [brasno]]);
  await db.query("reset role");
  return {
    sank, kuhinja, kafa, kutija, cokolada, mlijeko, brasno, dobavljac, sef,
    sankOsoblje: await napraviKorisnika(db, { ime: "Šank osoblje", uloga: "objekat", objekatId: sank }),
    kuhinjaOsoblje: await napraviKorisnika(db, { ime: "Kuhinja osoblje", uloga: "objekat", objekatId: kuhinja }),
    magacioner: await napraviKorisnika(db, { ime: "Amra", uloga: "magacioner" }),
  };
}

export type Stavka = { artikal_id: string; pakovanje_id?: string | null; kolicina: number };

export async function kao(db: Client, id: string) {
  await db.query("reset role");
  await prijaviKao(db, id);
}

export async function posalji(db: Client, stavke: Stavka[]): Promise<string> {
  const { rows } = await db.query("select magacin.posalji_zahtjev($1::jsonb) as id", [JSON.stringify(stavke)]);
  return rows[0].id;
}

export async function zahtjevi(db: Client, statusi: string[] | null = null) {
  const { rows } = await db.query("select * from magacin.zahtjevi($1::magacin.status_zahtjeva[])", [statusi]);
  return rows;
}

export async function odobri(db: Client, zahtjev: string, stavke: { stavka_id: string; kolicina: number }[] | null = null) {
  await db.query("select magacin.odobri_zahtjev($1, $2::jsonb)", [zahtjev, stavke ? JSON.stringify(stavke) : null]);
}

export async function odbij(db: Client, zahtjev: string, razlog: string) {
  await db.query("select magacin.odbij_zahtjev($1, $2)", [zahtjev, razlog]);
}

export const jedan = async (db: Client, id: string) => (await zahtjevi(db)).find((z) => z.id === id)!;

