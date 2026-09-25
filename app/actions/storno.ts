"use server";

import { revalidatePath } from "next/cache";
import { zahtijevajUlogu } from "@/lib/korisnik";
import type { VrstaStorna } from "@/lib/storno-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeStorna = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Menadžer poništava prijem, izdavanje ili otpis uz obavezan razlog; trag ostaje u knjigama. */
export async function stornirajRadnju(
  vrsta: VrstaStorna,
  id: string,
  _stanje: StanjeStorna,
  forma: FormData,
): Promise<StanjeStorna> {
  await zahtijevajUlogu("menadzer");
  const razlog = String(forma.get("razlog") ?? "");
  const supabase = await napraviServerKlijent();

  let error: { code?: string; message: string } | null;
  if (vrsta === "prijem") {
    if (!UUID.test(id)) return { greska: "Nepoznat prijem." };
    ({ error } = await supabase.rpc("storniraj_prijem", { p_prijem: id, p_razlog: razlog }));
  } else if (vrsta === "izdavanje") {
    if (!UUID.test(id)) return { greska: "Nepoznat zahtjev." };
    ({ error } = await supabase.rpc("storniraj_izdavanje", { p_zahtjev: id, p_razlog: razlog }));
  } else {
    if (!/^\d+$/.test(id)) return { greska: "Nepoznat otpis." };
    ({ error } = await supabase.rpc("storniraj_otpis", { p_kretanje: Number(id), p_razlog: razlog }));
  }
  if (error) {
    return {
      greska: error.code && PORUKE_ZA_KORISNIKA.has(error.code) ? error.message : "Storno nije uspio. Pokušajte ponovo.",
    };
  }
  revalidatePath("/menadzer", "layout");
  return undefined;
}
