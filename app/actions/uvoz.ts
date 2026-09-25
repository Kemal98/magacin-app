"use server";

import { revalidatePath } from "next/cache";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { pripremiUvoz, type PripremljenUvoz } from "@/lib/uvoz/pripremi";

const NAJVECI_FAJL = 5 * 1024 * 1024;

export type StanjePregleda =
  | { greska: string }
  | { pregled: PripremljenUvoz }
  | undefined;

/** Korak 1: čita Excel i vraća očišćen prijedlog na pregled; ništa se još ne upisuje. */
export async function pripremiPregled(
  _stanje: StanjePregleda,
  forma: FormData,
): Promise<StanjePregleda> {
  await zahtijevajUlogu("menadzer");
  const fajl = forma.get("fajl");
  if (typeof fajl === "string" || fajl === null || fajl.size === 0) {
    return { greska: "Izaberite Excel fajl (Utrošci - zalihe.xlsx)." };
  }
  if (fajl.size > NAJVECI_FAJL) return { greska: "Fajl je prevelik (najviše 5 MB)." };
  try {
    return { pregled: pripremiUvoz(new Uint8Array(await fajl.arrayBuffer())) };
  } catch (e) {
    return { greska: e instanceof Error ? e.message : "Fajl se ne može pročitati." };
  }
}

export type StanjeUvoza = { greska?: string; uvezeno?: { artikli: number; objekti: number; dobavljaci: number } } | undefined;

/** Korak 2: upisuje ono što je menadžer pregledao (uz njegove ispravke prehrana/materijal). */
export async function potvrdiUvoz(_stanje: StanjeUvoza, forma: FormData): Promise<StanjeUvoza> {
  await zahtijevajUlogu("menadzer");
  let podaci: PripremljenUvoz;
  try {
    podaci = JSON.parse(String(forma.get("podaci") ?? ""));
  } catch {
    return { greska: "Podaci za uvoz nisu ispravni. Učitajte fajl ponovo." };
  }
  // Menadžerovi izbori za prehranu/materijal dolaze kao vrsta_<redni broj>.
  const artikli = podaci.artikli.map((a, i) => ({
    naziv: a.naziv,
    mjera: a.mjera,
    vrsta: forma.get(`vrsta_${i}`) === "materijal" ? "materijal" : "prehrana",
  }));

  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("uvezi_sifrarnik", {
    p_artikli: artikli,
    p_objekti: podaci.objekti,
    p_dobavljaci: podaci.dobavljaci,
  });
  if (error) return { greska: "Uvoz nije uspio i ništa nije upisano. Pokušajte ponovo." };
  revalidatePath("/menadzer", "layout");
  return { uvezeno: data as { artikli: number; objekti: number; dobavljaci: number } };
}
