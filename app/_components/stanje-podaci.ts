import type { RedStanja } from "@/app/_components/stanje-tabela";
import { napraviServerKlijent } from "@/lib/supabase/server";

type RedIzBaze = {
  artikal_id: string;
  naziv: string;
  mjera: string;
  kolicina: string | number;
  prosjecna_cijena: string | number;
  vrijednost: string | number;
};

/** Stanje magacina prehrane iz baze, spremno za prikaz. */
export async function ucitajStanje(): Promise<RedStanja[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("stanje_magacina", { p_vrsta: "prehrana" });
  if (error) throw new Error(`Učitavanje stanja nije uspjelo: ${error.message}`);
  return (data as RedIzBaze[]).map((r) => ({
    id: r.artikal_id,
    naziv: r.naziv,
    mjera: r.mjera,
    kolicina: Number(r.kolicina),
    prosjecna_cijena: Number(r.prosjecna_cijena),
    vrijednost: Number(r.vrijednost),
  }));
}
