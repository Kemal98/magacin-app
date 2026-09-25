import type { RadnjaZaStorno } from "@/lib/storno-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

/** Prijemi, izdavanja i otpisi (i oni već poništeni), najnoviji prvi; samo menadžer. */
export async function ucitajRadnjeZaStorno(limit = 100): Promise<RadnjaZaStorno[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("storno_pregled", { p_limit: limit });
  if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);
  return data as RadnjaZaStorno[];
}
