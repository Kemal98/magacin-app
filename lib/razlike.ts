import { napraviServerKlijent } from "@/lib/supabase/server";

export type Razlika = {
  zahtjev_id: string;
  vrijeme: string;
  objekat: string;
  artikal: string;
  mjera: string;
  izdano: number | string;
  primljeno: number | string;
  razlika: number | string;
  vrijednost_razlike: number | string;
  primio: string;
};

/** Razlike pri prijemu (izdano se razlikuje od primljenog); samo magacioner i menadžer. */
export async function ucitajRazlike(limit = 50): Promise<Razlika[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("razlike_pri_prijemu", { p_limit: limit });
  if (error) throw new Error(`Učitavanje razlika nije uspjelo: ${error.message}`);
  return data as Razlika[];
}
