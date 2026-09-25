import { redirect } from "next/navigation";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type Uloga = "magacioner" | "objekat" | "menadzer";

export type Korisnik = { id: string; ime: string; uloga: Uloga };

export const POCETNA_ULOGE: Record<Uloga, string> = {
  magacioner: "/magacin",
  objekat: "/objekat",
  menadzer: "/menadzer",
};

// SQLSTATE koji baza vraća kad niko nije prijavljen ili je osoba isključena.
const NIJE_PRIJAVLJEN = "28000";

/**
 * Osoba koja je prijavljena (ime i uloga iz baze), ili null ako niko nije prijavljen.
 * Prava greška (baza ili mreža) se ne prikriva kao odjava, nego se prijavljuje.
 */
export async function trenutniKorisnik(): Promise<Korisnik | null> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("trenutni_korisnik");
  if (error) {
    if (error.code === NIJE_PRIJAVLJEN) return null;
    throw new Error(`Provjera prijave nije uspjela: ${error.message}`);
  }
  if (!data) return null;
  const { id, ime, uloga } = data as Korisnik;
  return { id, ime, uloga };
}

/**
 * Za ekrane jedne uloge: neprijavljenog vraća na prijavu, a osobu druge uloge
 * na njen vlastiti početni ekran.
 */
export async function zahtijevajUlogu(uloga: Uloga): Promise<Korisnik> {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) redirect("/prijava");
  if (korisnik.uloga !== uloga) redirect(POCETNA_ULOGE[korisnik.uloga]);
  return korisnik;
}
