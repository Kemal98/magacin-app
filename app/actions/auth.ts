"use server";

import { redirect } from "next/navigation";
import { porukaZakljucano } from "@/lib/prijava-poruke";
import { napraviAdminKlijent } from "@/lib/supabase/admin";
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

/**
 * Prijava s zaštitom od pogađanja: račun se vodi po osobi, ne po IP adresi. Dok je zaključan, PIN se uopće
 * ne provjerava (pa ni tačan PIN ne prolazi i ne može se testirati). Poslije 5 uzastopnih pogrešnih
 * pokušaja račun se zaključavao (ukinuto migracijom 20260927110000: funkcije više ne zaključavaju); uspješna prijava poništava brojač. Brojač vodi server
 * tajnim ključem, jer ga preglednik ne smije moći mijenjati.
 */
async function prijaviSaZastitom(
  korisnikId: string,
  prijava: (supabase: ServerKlijent) => Promise<{ error: unknown }>,
  pogresnoPoruka: string,
): Promise<StanjePrijave> {
  const admin = napraviAdminKlijent();
  const { data: zakljucanDo } = await admin.rpc("provjeri_zakljucavanje", { p_korisnik: korisnikId });
  if (zakljucanDo) return { greska: porukaZakljucano(zakljucanDo) };

  const supabase = await napraviServerKlijent();
  const { error } = await prijava(supabase);
  if (error) {
    const { data } = await admin.rpc("zabiljezi_neuspjeli_pokusaj", { p_korisnik: korisnikId });
    const red = Array.isArray(data) ? data[0] : data;
    if (red?.zakljucan_do) return { greska: porukaZakljucano(red.zakljucan_do) };
    return { greska: pogresnoPoruka };
  }
  await admin.rpc("zabiljezi_uspjesnu_prijavu", { p_korisnik: korisnikId });
  const neaktivan = await potvrdiAktivnogKorisnika(supabase);
  if (neaktivan) return neaktivan;
  redirect("/");
}

/** Prijava magacionera i osoblja objekta: izabrano ime + PIN. */
export async function prijaviPinom(korisnikId: string, pin: string): Promise<StanjePrijave> {
  if (!ID.test(korisnikId) || !PIN.test(pin)) {
    return { greska: "Unesite šestocifreni PIN." };
  }
  return prijaviSaZastitom(
    korisnikId,
    (supabase) =>
      supabase.auth.signInWithPassword({ email: `${korisnikId}@korisnik.magacin.local`, password: pin }),
    "Pogrešan PIN. Pokušajte ponovo.",
  );
}

/** Prijava menadžera: email i lozinka (isto zaštićeno brojačem, po računu). */
export async function prijaviMenadzera(_stanje: StanjePrijave, forma: FormData): Promise<StanjePrijave> {
  const email = String(forma.get("email") ?? "").trim();
  const lozinka = String(forma.get("lozinka") ?? "");
  if (!email || !lozinka) {
    return { greska: "Unesite email i lozinku." };
  }
  const { data: korisnikId } = await napraviAdminKlijent().rpc("korisnik_po_emailu", { p_email: email });
  const pogresno = "Pogrešan email ili lozinka.";
  if (!korisnikId) {
    // Nepoznata adresa: ista poruka kao za pogrešnu lozinku, da se ne otkriva koje adrese postoje.
    const supabase = await napraviServerKlijent();
    await supabase.auth.signInWithPassword({ email, password: lozinka });
    return { greska: pogresno };
  }
  return prijaviSaZastitom(
    korisnikId as string,
    (supabase) => supabase.auth.signInWithPassword({ email, password: lozinka }),
    pogresno,
  );
}

export async function odjavi() {
  const supabase = await napraviServerKlijent();
  await supabase.auth.signOut();
  redirect("/prijava");
}
