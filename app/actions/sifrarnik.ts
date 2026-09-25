"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeForme = { greska?: string } | undefined;

// Greške koje su poruke za korisnika (naše provjere u bazi), za razliku od tehničkih.
const PORUKE_ZA_KORISNIKA = new Set(["23505", "22023", "42501", "P0002"]);

function poruka(error: { code?: string; message: string }): string {
  return error.code && PORUKE_ZA_KORISNIKA.has(error.code)
    ? error.message
    : "Snimanje nije uspjelo. Pokušajte ponovo.";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MJERE = ["kg", "l", "kom"];
const VRSTE = ["prehrana", "materijal"];

/** Broj iz forme; dozvoljava i zarez kao decimalni znak. */
function broj(tekst: string): number {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
}

export async function sacuvajArtikal(
  _stanje: StanjeForme,
  forma: FormData,
): Promise<StanjeForme> {
  const id = String(forma.get("id") ?? "");
  const mjera = String(forma.get("mjera") ?? "");
  const vrsta = String(forma.get("vrsta") ?? "");
  const minimum = broj(String(forma.get("minimum") ?? "0") || "0");
  if (id && !UUID.test(id)) return { greska: "Nepoznat artikal." };
  if (!MJERE.includes(mjera)) return { greska: "Izaberite osnovnu mjeru." };
  if (!VRSTE.includes(vrsta)) return { greska: "Izaberite magacin." };
  if (!Number.isFinite(minimum) || minimum < 0) {
    return { greska: "Minimum mora biti broj, nula ili veći." };
  }

  const ids = forma.getAll("pak_id").map(String);
  const nazivi = forma.getAll("pak_naziv").map(String);
  const faktori = forma.getAll("pak_faktor").map(String);
  const kodovi = forma.getAll("pak_bar_kod").map(String);
  const pakovanja = [];
  for (let i = 0; i < nazivi.length; i++) {
    if (!nazivi[i].trim() && !faktori[i].trim()) continue; // prazan red
    const faktor = broj(faktori[i]);
    if (!Number.isFinite(faktor) || faktor <= 0) {
      return { greska: `Faktor pakovanja "${nazivi[i].trim()}" mora biti broj veći od nule.` };
    }
    pakovanja.push({
      id: UUID.test(ids[i]) ? ids[i] : null,
      naziv: nazivi[i],
      faktor,
      bar_kod: kodovi[i],
    });
  }

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("sacuvaj_artikal", {
    p_id: id || null,
    p_naziv: String(forma.get("naziv") ?? ""),
    p_mjera: mjera,
    p_bar_kod: String(forma.get("bar_kod") ?? ""),
    p_minimum: minimum,
    p_vrsta: vrsta,
    p_pakovanja: pakovanja,
  });
  if (error) return { greska: poruka(error) };
  redirect("/menadzer/artikli");
}

type Vrsta = "artikal" | "objekat" | "dobavljac";

export async function promijeniAktivnost(
  vrsta: Vrsta,
  id: string,
  aktivan: boolean,
): Promise<void> {
  if (!UUID.test(id)) return;
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc(
    vrsta === "artikal"
      ? "postavi_aktivnost_artikla"
      : vrsta === "objekat"
        ? "postavi_aktivnost_objekta"
        : "postavi_aktivnost_dobavljaca",
    { p_id: id, p_aktivan: aktivan },
  );
  if (error) throw new Error(poruka(error));
  revalidatePath("/menadzer", "layout");
}

/** Dodavanje i preimenovanje objekta ili dobavljača. */
export async function sacuvajNaziv(
  vrsta: "objekat" | "dobavljac",
  _stanje: StanjeForme,
  forma: FormData,
): Promise<StanjeForme> {
  const id = String(forma.get("id") ?? "");
  if (id && !UUID.test(id)) return { greska: "Nepoznat zapis." };
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc(
    vrsta === "objekat" ? "sacuvaj_objekat" : "sacuvaj_dobavljaca",
    { p_id: id || null, p_naziv: String(forma.get("naziv") ?? "") },
  );
  if (error) return { greska: poruka(error) };
  revalidatePath("/menadzer", "layout");
  return undefined;
}
