import { napraviServerKlijent } from "@/lib/supabase/server";

export type ZaNaruciti = {
  artikal_id: string;
  naziv: string;
  mjera: string;
  kolicina: number | string;
  minimum: number | string;
  nedostaje: number | string;
};

/** Artikli ispod minimuma (najprazniji prvi); vide ih magacioner i menadžer. */
export async function ucitajIspodMinimuma(): Promise<ZaNaruciti[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("artikli_ispod_minimuma", { p_vrsta: "prehrana" });
  if (error) throw new Error(`Učitavanje artikala ispod minimuma nije uspjelo: ${error.message}`);
  return data as ZaNaruciti[];
}
