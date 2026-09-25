import { napraviServerKlijent } from "@/lib/supabase/server";
import type { StatusZahtjeva, Zahtjev } from "@/lib/zahtjevi-tipovi";

/** Zahtjevi koje prijavljena osoba smije vidjeti (objekat svoje, magacin sve). */
export async function ucitajZahtjeve(statusi?: StatusZahtjeva[], limit = 100): Promise<Zahtjev[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("zahtjevi", { p_statusi: statusi ?? null, p_limit: limit });
  if (error) throw new Error(`Učitavanje zahtjeva nije uspjelo: ${error.message}`);
  return data as Zahtjev[];
}
