"use server";

import { redirect } from "next/navigation";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjePrijave = { greska?: string } | undefined;

const PIN = /^\d{6}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prijava u Auth može uspjeti i za osobu koja nema aktivan zapis u magacinu
 * (isključena je). Takvu sesiju odmah zatvaramo i javljamo razlog.
 */
async function potvrdiAktivnogKorisnika(
  supabase: Awaited<ReturnType<typeof napraviServerKlijent>>,
): Promise<StanjePrijave> {
  const { error } = await supabase.rpc("trenutni_korisnik");
  if (!error) return undefined;
  await supabase.auth.signOut();
  return { greska: "Ovaj račun nije aktivan. Obratite se menadžeru." };
}

/** Prijava magacionera i osoblja objekta: izabrano ime + PIN. */
export async function prijaviPinom(
  korisnikId: string,
  pin: string,
): Promise<StanjePrijave> {
  if (!ID.test(korisnikId) || !PIN.test(pin)) {
    return { greska: "Unesite šestocifreni PIN." };
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${korisnikId}@korisnik.magacin.local`,
    password: pin,
  });
  if (error) return { greska: "Pogrešan PIN. Pokušajte ponovo." };
  const neaktivan = await potvrdiAktivnogKorisnika(supabase);
  if (neaktivan) return neaktivan;
  redirect("/");
}

/** Prijava menadžera: email i lozinka. */
export async function prijaviMenadzera(
  _stanje: StanjePrijave,
  forma: FormData,
): Promise<StanjePrijave> {
  const email = String(forma.get("email") ?? "").trim();
  const lozinka = String(forma.get("lozinka") ?? "");
  if (!email || !lozinka) {
    return { greska: "Unesite email i lozinku." };
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: lozinka,
  });
  if (error) return { greska: "Pogrešan email ili lozinka." };
  const neaktivan = await potvrdiAktivnogKorisnika(supabase);
  if (neaktivan) return neaktivan;
  redirect("/");
}

export async function odjavi() {
  const supabase = await napraviServerKlijent();
  await supabase.auth.signOut();
  redirect("/prijava");
}
