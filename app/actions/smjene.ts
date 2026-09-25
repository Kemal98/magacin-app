"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { broj } from "@/lib/broj";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeForme = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VRIJEME = /^([01]\d|2[0-3]):[0-5]\d$/;

const poruka = (e: { code?: string; message: string }) =>
  e.code && PORUKE_ZA_KORISNIKA.has(e.code) ? e.message : "Radnja nije uspjela. Pokušajte ponovo.";

/** Objekat zatvara smjenu: ime osobe i završno stanje (zavrsno_<artikal>, razlog_<artikal>). */
export async function zatvoriSmjenu(_stanje: StanjeForme, forma: FormData): Promise<StanjeForme> {
  await zahtijevajUlogu("objekat");
  const stanje = [];
  for (const [ime, vrijednost] of forma.entries()) {
    if (!ime.startsWith("zavrsno_")) continue;
    const tekst = String(vrijednost);
    if (tekst.trim() === "") continue; // prazno = nije brojano; server traži ono što je obavezno
    const artikal = ime.slice("zavrsno_".length);
    const kolicina = broj(tekst);
    if (!UUID.test(artikal)) return { greska: "Podaci nisu ispravni. Osvježite stranicu." };
    if (!Number.isFinite(kolicina) || kolicina < 0) {
      return { greska: "Završno stanje mora biti broj, nula ili veći." };
    }
    stanje.push({ artikal_id: artikal, zavrsno: kolicina, razlog: String(forma.get(`razlog_${artikal}`) ?? "") });
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("zatvori_smjenu", {
    p_ime: String(forma.get("ime") ?? ""),
    p_stanje: stanje,
  });
  if (error) return { greska: poruka(error) };
  revalidatePath("/objekat", "layout");
  redirect("/objekat/smjene?zatvorena=1");
}

/** Objekat evidentira izuzetak (razbijeno, proliveno...) uz obavezan razlog. */
export async function dodajIzuzetak(_stanje: StanjeForme, forma: FormData): Promise<StanjeForme> {
  await zahtijevajUlogu("objekat");
  const artikal = String(forma.get("artikal") ?? "");
  const kolicina = broj(String(forma.get("kolicina") ?? ""));
  if (!UUID.test(artikal)) return { greska: "Izaberite artikal." };
  if (!Number.isFinite(kolicina) || kolicina <= 0) return { greska: "Količina mora biti veća od nule." };
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("dodaj_izuzetak", {
    p_artikal: artikal,
    p_kolicina: kolicina,
    p_razlog: String(forma.get("razlog") ?? ""),
  });
  if (error) return { greska: poruka(error) };
  revalidatePath("/objekat", "layout");
  redirect("/objekat/izuzetak?dodano=1");
}

/** Menadžer zadaje smjene objekta (naziv, od, do). */
export async function sacuvajRaspored(
  objekatId: string,
  _stanje: StanjeForme,
  forma: FormData,
): Promise<StanjeForme> {
  await zahtijevajUlogu("menadzer");
  if (!UUID.test(objekatId)) return { greska: "Nepoznat objekat." };
  const nazivi = forma.getAll("naziv").map(String);
  const pocetci = forma.getAll("pocetak").map(String);
  const krajevi = forma.getAll("kraj").map(String);
  const smjene = [];
  for (let i = 0; i < nazivi.length; i++) {
    if (!nazivi[i].trim() && !pocetci[i] && !krajevi[i]) continue; // prazan red
    if (!VRIJEME.test(pocetci[i] ?? "") || !VRIJEME.test(krajevi[i] ?? "")) {
      return { greska: `Smjena ${i + 1}: upišite satnicu u obliku HH:MM.` };
    }
    smjene.push({ naziv: nazivi[i], pocetak: pocetci[i], kraj: krajevi[i] });
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("postavi_smjene_objekta", { p_objekat: objekatId, p_smjene: smjene });
  if (error) return { greska: poruka(error) };
  revalidatePath("/menadzer", "layout");
  redirect("/menadzer/objekti");
}
