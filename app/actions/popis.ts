"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { broj } from "@/lib/broj";
import { zahtijevajUlogu } from "@/lib/korisnik";
import type { RedPregleda } from "@/lib/popis-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjePregleda = { greska: string } | { redovi: RedPregleda[] } | undefined;
export type StanjePotvrde = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const poruka = (e: { code?: string; message: string }) =>
  e.code && PORUKE_ZA_KORISNIKA.has(e.code) ? e.message : "Radnja nije uspjela. Pokušajte ponovo.";

/** Izbrojane količine iz forme (brojano_<artikal>); prazno polje znači da artikal nije brojan. */
function izbrojano(forma: FormData): { artikal_id: string; brojano: number }[] | string {
  const stavke = [];
  for (const [ime, vrijednost] of forma.entries()) {
    if (!ime.startsWith("brojano_") || String(vrijednost).trim() === "") continue;
    const artikal = ime.slice("brojano_".length);
    const kolicina = broj(String(vrijednost));
    if (!UUID.test(artikal)) return "Podaci nisu ispravni. Osvježite stranicu.";
    if (!Number.isFinite(kolicina) || kolicina < 0) return "Izbrojana količina mora biti broj, nula ili veći.";
    stavke.push({ artikal_id: artikal, brojano: kolicina });
  }
  return stavke;
}

/** Prvi korak: razlika između sistema i izbrojanog, bez ikakvog upisa. */
export async function pregledajPopis(_stanje: StanjePregleda, forma: FormData): Promise<StanjePregleda> {
  await zahtijevajUlogu("magacioner");
  const stavke = izbrojano(forma);
  if (typeof stavke === "string") return { greska: stavke };
  if (stavke.length === 0) return { greska: "Upišite izbrojanu količinu bar za jedan artikal." };
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("pregled_popisa", { p_stavke: stavke });
  if (error) return { greska: poruka(error) };
  type Sirovo = { [k in keyof RedPregleda]: unknown };
  return {
    redovi: (data as Sirovo[]).map((r) => ({
      artikal_id: String(r.artikal_id),
      naziv: String(r.naziv),
      mjera: String(r.mjera),
      sistem: Number(r.sistem),
      brojano: Number(r.brojano),
      razlika: Number(r.razlika),
      cijena: r.cijena === null ? null : Number(r.cijena),
      vrijednost_razlike: Number(r.vrijednost_razlike),
      treba_cijenu: Boolean(r.treba_cijenu),
    })),
  };
}

/** Drugi korak: potvrda usklađuje stanje. Uz brojano šalje i stanje viđeno u pregledu (sistem_<artikal>). */
export async function potvrdiPopis(_stanje: StanjePotvrde, forma: FormData): Promise<StanjePotvrde> {
  await zahtijevajUlogu("magacioner");
  const stavke = [];
  for (const [ime, vrijednost] of forma.entries()) {
    if (!ime.startsWith("brojano_")) continue;
    const artikal = ime.slice("brojano_".length);
    if (!UUID.test(artikal)) return { greska: "Podaci nisu ispravni. Osvježite stranicu." };
    const cijena = broj(String(forma.get(`cijena_${artikal}`) ?? ""));
    stavke.push({
      artikal_id: artikal,
      brojano: broj(String(vrijednost)),
      sistem: broj(String(forma.get(`sistem_${artikal}`) ?? "")),
      cijena: Number.isFinite(cijena) ? cijena : null,
    });
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("potvrdi_popis", {
    p_stavke: stavke.map((s) => ({ ...s, sistem: Number.isFinite(s.sistem) ? s.sistem : null })),
    p_pocetno: forma.get("pocetno") === "on",
  });
  if (error) return { greska: poruka(error) };
  revalidatePath("/magacin", "layout");
  redirect("/magacin/popis?potvrdjeno=1");
}
