import { napraviServerKlijent } from "@/lib/supabase/server";

export type Otpis = {
  vrijeme: string;
  artikal: string;
  mjera: string;
  kolicina: number | string;
  razlog: string;
  cijena: number | string;
  vrijednost: number | string;
  ime: string;
};

/** Otpisi magacina, najnoviji prvi; vide ih magacioner i menadžer. */
export async function ucitajOtpise(limit = 50): Promise<Otpis[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("otpisi_magacina", { p_limit: limit });
  if (error) throw new Error(`Učitavanje otpisa nije uspjelo: ${error.message}`);
  return data as Otpis[];
}
