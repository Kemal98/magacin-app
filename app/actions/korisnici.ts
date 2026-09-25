"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adresaZaPin, provjeriEmail, provjeriLozinku, provjeriPin } from "@/lib/korisnici-validacija";
import { zahtijevajUlogu, type Uloga } from "@/lib/korisnik";
import { napraviAdminKlijent } from "@/lib/supabase/admin";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeKorisnika = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "23505", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULOGE: Uloga[] = ["magacioner", "objekat", "menadzer"];

const poruka = (e: { code?: string; message: string }) =>
  e.code && PORUKE_ZA_KORISNIKA.has(e.code) ? e.message : "Radnja nije uspjela. Pokušajte ponovo.";

const tekst = (forma: FormData, ime: string) => String(forma.get(ime) ?? "").trim();

/**
 * Menadžer dodaje korisnika. Magacioner i osoblje objekta dobijaju PIN, menadžer e-adresu i lozinku.
 * Račun se pravi administratorskim API-jem, pa se osoba upisuje u magacin (funkcija u bazi provjerava
 * da je pozivalac menadžer); ako upis ne uspije, račun se odmah briše da ne ostane siroče.
 */
export async function dodajKorisnika(_stanje: StanjeKorisnika, forma: FormData): Promise<StanjeKorisnika> {
  await zahtijevajUlogu("menadzer");
  const ime = tekst(forma, "ime");
  const uloga = tekst(forma, "uloga") as Uloga;
  const objekat = tekst(forma, "objekat");
  if (!ime) return { greska: "Upišite ime." };
  if (!ULOGE.includes(uloga)) return { greska: "Izaberite ulogu." };
  if (uloga === "objekat" && !UUID.test(objekat)) return { greska: "Izaberite objekat za osoblje objekta." };

  const id = randomUUID();
  let email: string;
  let lozinka: string;
  if (uloga === "menadzer") {
    email = tekst(forma, "email").toLowerCase();
    lozinka = String(forma.get("lozinka") ?? "");
    const greska = provjeriEmail(email) ?? provjeriLozinku(lozinka);
    if (greska) return { greska };
  } else {
    lozinka = tekst(forma, "pin");
    const greska = provjeriPin(lozinka);
    if (greska) return { greska };
    email = adresaZaPin(id);
  }

  const admin = napraviAdminKlijent();
  const { error: greskaRacuna } = await admin.auth.admin.createUser({
    id,
    email,
    password: lozinka,
    email_confirm: true,
  } as Parameters<typeof admin.auth.admin.createUser>[0]);
  if (greskaRacuna) {
    return {
      greska: /already|registered|exists/i.test(greskaRacuna.message)
        ? "Ta e-adresa se već koristi."
        : "Račun nije napravljen. Pokušajte ponovo.",
    };
  }

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("dodaj_korisnika", {
    p_id: id,
    p_ime: ime,
    p_uloga: uloga,
    p_objekat: uloga === "objekat" ? objekat : null,
  });
  if (error) {
    await admin.auth.admin.deleteUser(id);
    return { greska: poruka(error) };
  }
  revalidatePath("/menadzer", "layout");
  redirect("/menadzer/korisnici");
}

/** Menadžer mijenja ime, objekat (osoblje objekta) i, ako upiše, novi PIN ili lozinku. */
export async function izmijeniKorisnika(
  id: string,
  uloga: Uloga,
  _stanje: StanjeKorisnika,
  forma: FormData,
): Promise<StanjeKorisnika> {
  await zahtijevajUlogu("menadzer");
  if (!UUID.test(id) || !ULOGE.includes(uloga)) return { greska: "Nepoznat korisnik." };
  const ime = tekst(forma, "ime");
  const objekat = tekst(forma, "objekat");
  const novaTajna = uloga === "menadzer" ? String(forma.get("lozinka") ?? "") : tekst(forma, "pin");
  if (!ime) return { greska: "Upišite ime." };
  if (uloga === "objekat" && !UUID.test(objekat)) return { greska: "Izaberite objekat za osoblje objekta." };
  if (novaTajna) {
    const greska = uloga === "menadzer" ? provjeriLozinku(novaTajna) : provjeriPin(novaTajna);
    if (greska) return { greska };
  }

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("izmijeni_korisnika", {
    p_id: id,
    p_ime: ime,
    p_objekat: uloga === "objekat" ? objekat : null,
  });
  if (error) return { greska: poruka(error) };

  if (novaTajna) {
    const { error: greskaTajne } = await napraviAdminKlijent().auth.admin.updateUserById(id, { password: novaTajna });
    if (greskaTajne) {
      return { greska: `Ime je sačuvano, ali ${uloga === "menadzer" ? "lozinka" : "PIN"} nije promijenjen. Pokušajte ponovo.` };
    }
    // Novi PIN znači i novi početak: račun se otključava.
    await supabase.rpc("otkljucaj_korisnika", { p_korisnik: id });
  }
  revalidatePath("/menadzer", "layout");
  redirect("/menadzer/korisnici");
}

/** Isključuje ili ponovo uključuje korisnika (isključen se ne nudi za prijavu i ne može raditi). */
export async function promijeniAktivnostKorisnika(id: string, aktivan: boolean): Promise<void> {
  await zahtijevajUlogu("menadzer");
  if (!UUID.test(id)) return;
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("postavi_aktivnost_korisnika", { p_id: id, p_aktivan: aktivan });
  if (error) throw new Error(poruka(error));
  revalidatePath("/menadzer", "layout");
}

/** Menadžer odmah otključava račun zaključan zbog pogrešnih PIN-ova. */
export async function otkljucajKorisnika(id: string): Promise<void> {
  await zahtijevajUlogu("menadzer");
  if (!UUID.test(id)) return;
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("otkljucaj_korisnika", { p_korisnik: id });
  if (error) throw new Error(poruka(error));
  revalidatePath("/menadzer", "layout");
}
