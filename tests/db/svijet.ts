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

/** Roba ulazi u zalihu objekta kroz cijeli tok: prijem, zahtjev, odobravanje, izdavanje i STIGLO. */
export async function uZalihuObjekta(db: Client, s: Svijet, artikal: string, kolicina: number, cijena: number) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
  await kao(db, s.sankOsoblje);
  const id = await posalji(db, [{ artikal_id: artikal, kolicina }]);
  await kao(db, s.magacioner);
  await odobri(db, id);
  await db.query("select magacin.izdaj_zahtjev($1)", [id]);
  await kao(db, s.sankOsoblje);
  await db.query("select magacin.potvrdi_primljeno($1)", [id]);
  return id;
}

/** Zahtjev izdat, ali objekat još nije potvrdio da je roba stigla. */
export async function naDostavi(db: Client, s: Svijet, artikal: string, kolicina: number, cijena: number) {
  await kao(db, s.magacioner);
  await db.query("select magacin.unesi_prijem($1, $2::jsonb)", [
    s.dobavljac,
    JSON.stringify([{ artikal_id: artikal, kolicina, cijena }]),
  ]);
  await kao(db, s.sankOsoblje);
  const id = await posalji(db, [{ artikal_id: artikal, kolicina }]);
  await kao(db, s.magacioner);
  await odobri(db, id);
  await db.query("select magacin.izdaj_zahtjev($1)", [id]);
  return id;
}

export type Unos = { artikal_id: string; zavrsno: number; razlog?: string };

export async function zatvori(db: Client, ime: string, stanje: Unos[]): Promise<string> {
  const { rows } = await db.query("select magacin.zatvori_smjenu($1, $2::jsonb) as id", [ime, JSON.stringify(stanje)]);
  return rows[0].id;
}

/** Zatvorene smjene kako ih vidi trenutno prijavljena osoba, najnovija prva. */
export async function smjene(db: Client, objekat: string | null = null) {
  return (await db.query("select * from magacin.smjene_objekta($1, 50)", [objekat])).rows;
}

export const stavka = (smjena: { stavke: { artikal: string }[] }, naziv: string) =>
  smjena.stavke.find((x) => x.artikal === naziv) as Record<string, string | number | null>;

export const zalihaObjekta = async (db: Client) => {
  const { rows } = await db.query("select * from magacin.zaliha_objekta()");
  return new Map(rows.map((r) => [r.naziv as string, Number(r.kolicina)]));
};

/** Knjiga objekta čita magacioner (sadrži cijene). */
export async function knjigaObjekta(db: Client, s: Svijet, vrsta?: string) {
  await kao(db, s.magacioner);
  const { rows } = await db.query(
    "select vrsta, kolicina, cijena, napomena from magacin.kretanje_objekta where objekat_id = $1 and ($2::text is null or vrsta::text = $2) order by id",
    [s.sank, vrsta ?? null],
  );
  return rows.map((r) => ({ ...r, kolicina: Number(r.kolicina), cijena: Number(r.cijena) }));
}

