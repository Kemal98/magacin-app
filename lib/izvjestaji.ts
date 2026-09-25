import type { RedIzvjestaja } from "@/lib/izvjestaji-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

const BROJEVI = [
  "izdato", "manjak", "potroseno", "izuzeci", "visak", "razlika", "promjena_zalihe",
  "zaliha_sada", "vrijednost_izdatog", "trosak_potrosnje", "trosak_izuzetaka",
] as const;

/** Izvještaj po objektima i artiklima za period (datumi "GGGG-MM-DD"); samo menadžer. */
export async function ucitajIzvjestaj(od: string, do_: string, objekatId?: string): Promise<RedIzvjestaja[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("izvjestaj_objekata", {
    p_od: od,
    p_do: do_,
    p_objekat: objekatId ?? null,
  });
  if (error) throw new Error(`Učitavanje izvještaja nije uspjelo: ${error.message}`);
  return (data as Record<string, unknown>[]).map((r) => {
    const red = { ...r } as Record<string, unknown>;
    for (const k of BROJEVI) red[k] = Number(r[k]);
    return red as unknown as RedIzvjestaja;
  });
}

export async function ucitajObjekte(): Promise<{ id: string; naziv: string }[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.from("objekat").select("id, naziv").eq("aktivan", true).order("naziv");
  if (error) throw new Error(`Učitavanje objekata nije uspjelo: ${error.message}`);
  return data;
}
