import type { PopisMagacina } from "@/lib/popis-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

/** Popisi magacina, najnoviji prvi; vide ih magacioner i menadžer. */
export async function ucitajPopise(limit = 20): Promise<PopisMagacina[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("popisi_magacina", { p_limit: limit });
  if (error) throw new Error(`Učitavanje popisa nije uspjelo: ${error.message}`);
  return data as PopisMagacina[];
}
