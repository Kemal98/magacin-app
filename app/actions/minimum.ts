"use server";

import { revalidatePath } from "next/cache";
import { broj } from "@/lib/broj";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeMinimuma = { greska?: string; snimljeno?: boolean } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Magacioner zadaje ili mijenja minimum zaliha za jedan artikal. */
export async function postaviMinimum(
  artikalId: string,
  _stanje: StanjeMinimuma,
  forma: FormData,
): Promise<StanjeMinimuma> {
  await zahtijevajUlogu("magacioner");
  if (!UUID.test(artikalId)) return { greska: "Nepoznat artikal." };
  const tekst = String(forma.get("minimum") ?? "");
  const minimum = tekst.trim() === "" ? 0 : broj(tekst); // prazno polje = bez minimuma
  if (!Number.isFinite(minimum) || minimum < 0) return { greska: "Minimum mora biti broj, nula ili veći." };
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("postavi_minimum", { p_artikal: artikalId, p_minimum: minimum });
  if (error) return { greska: "Minimum nije snimljen. Pokušajte ponovo." };
  revalidatePath("/magacin", "layout");
  return { snimljeno: true };
}
