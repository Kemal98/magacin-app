"use server";

import { redirect } from "next/navigation";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjePrijave = { greska?: string } | undefined;

const PIN = /^\d{6}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServerKlijent = Awaited<ReturnType<typeof napraviServerKlijent>>;

/**
 * Prijava u Auth može uspjeti i za osobu koja nema aktivan zapis u magacinu
 * (isključena je). Takvu sesiju odmah zatvaramo i javljamo razlog.
 */
async function potvrdiAktivnogKorisnika(supabase: ServerKlijent): Promise<StanjePrijave> {
  const { error } = await supabase.rpc("trenutni_korisnik");
  if (!error) return undefined;
  await supabase.auth.signOut();
  return { greska: "Ovaj račun nije aktivan. Obratite se menadžeru." };
}

/** Prijava bez brojača pokušaja (zaključavanje je ukinuto); ne treba tajni ključ. */
async function prijaviSe(
  prijava: (supabase: ServerKlijent) => Promise<{ error: unknown }>,
  pogresnoPoruka: string,
): Promise<StanjePrijave> {
  const supabase = await napraviServerKlijent();
  const { error } = await prijava(supabase);
  if (error) return { greska: pogresnoPoruka };
  const neaktivan = await potvrdiAktivnogKorisnika(supabase);
  if (neaktivan) return neaktivan;
  redirect("/");
}

/** Prijava magacionera i osoblja objekta: izabrano ime + PIN. */
export async function prijaviPinom(korisnikId: string, pin: string): Promise<StanjePrijave> {
  if (!ID.test(korisnikId) || !PIN.test(pin)) {
    return { greska: "Unesite šestocifreni PIN." };
  }
  return prijaviSe(
    (supabase) =>
      supabase.auth.signInWithPassword({ email: `${korisnikId}@korisnik.magacin.local`, password: pin }),
    "Pogrešan PIN. Pokušajte ponovo.",
  );
}

/** Prijava menadžera: email i lozinka. */
export async function prijaviMenadzera(_stanje: StanjePrijave, forma: FormData): Promise<StanjePrijave> {
  const email = String(forma.get("email") ?? "").trim();
  const lozinka = String(forma.get("lozinka") ?? "");
  if (!email || !lozinka) {
    return { greska: "Unesite email i lozinku." };
  }
  return prijaviSe((supabase) => supabase.auth.signInWithPassword({ email, password: lozinka }), "Pogrešan email ili lozinka.");
}

export async function odjavi() {
  const supabase = await napraviServerKlijent();
  await supabase.auth.signOut();
  redirect("/prijava");
}
