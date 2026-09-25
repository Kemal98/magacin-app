"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeForme = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const poruka = (e: { code?: string; message: string }) =>
  e.code && PORUKE_ZA_KORISNIKA.has(e.code) ? e.message : "Radnja nije uspjela. Pokušajte ponovo.";

/** Broj iz forme; dozvoljava i zarez kao decimalni znak. */
function broj(tekst: string): number {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
}

/** Objekat šalje zahtjev za robu. */
export async function posaljiZahtjev(_stanje: StanjeForme, forma: FormData): Promise<StanjeForme> {
  await zahtijevajUlogu("objekat");
  const artikli = forma.getAll("artikal").map(String);
  const pakovanja = forma.getAll("pakovanje").map(String);
  const kolicine = forma.getAll("kolicina").map(String);
  if (artikli.length === 0) return { greska: "Dodajte bar jedan artikal." };

  const stavke = [];
  for (let i = 0; i < artikli.length; i++) {
    const kol = broj(kolicine[i] ?? "");
    if (!UUID.test(artikli[i])) return { greska: "Artikal nije ispravan. Osvježite stranicu." };
    if (!Number.isFinite(kol) || kol <= 0) return { greska: "Količina mora biti veća od nule." };
    stavke.push({
      artikal_id: artikli[i],
      pakovanje_id: UUID.test(pakovanja[i] ?? "") ? pakovanja[i] : null,
      kolicina: kol,
    });
  }

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("posalji_zahtjev", { p_stavke: stavke });
  if (error) return { greska: poruka(error) };
  redirect("/objekat?poslano=1");
}

/** Magacioner odobrava zahtjev; količine iz forme (kolicina_<stavka>) mogu biti manje od tražene. */
export async function odobriZahtjev(
  zahtjevId: string,
  _stanje: StanjeForme,
  forma: FormData,
): Promise<StanjeForme> {
  await zahtijevajUlogu("magacioner");
  if (!UUID.test(zahtjevId)) return { greska: "Nepoznat zahtjev." };
  const stavke = [];
  for (const [ime, vrijednost] of forma.entries()) {
    if (!ime.startsWith("kolicina_")) continue;
    const kol = broj(String(vrijednost));
    if (!Number.isFinite(kol) || kol < 0) return { greska: "Količina mora biti broj, nula ili veći." };
    stavke.push({ stavka_id: ime.slice("kolicina_".length), kolicina: kol });
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("odobri_zahtjev", { p_zahtjev: zahtjevId, p_stavke: stavke });
  if (error) return { greska: poruka(error) };
  revalidatePath("/magacin", "layout");
  return undefined;
}

export async function odbijZahtjev(
  zahtjevId: string,
  _stanje: StanjeForme,
  forma: FormData,
): Promise<StanjeForme> {
  await zahtijevajUlogu("magacioner");
  if (!UUID.test(zahtjevId)) return { greska: "Nepoznat zahtjev." };
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("odbij_zahtjev", {
    p_zahtjev: zahtjevId,
    p_razlog: String(forma.get("razlog") ?? ""),
  });
  if (error) return { greska: poruka(error) };
  revalidatePath("/magacin", "layout");
  return undefined;
}
