import type { ArtikalDobavljaca, DobavljacNabavka, Isporuka } from "@/lib/nabavka-tipovi";
import { napraviServerKlijent } from "@/lib/supabase/server";

const broj = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Pregled svih dobavljača za period; magacioner i menadžer. */
export async function ucitajNabavku(od: string, do_: string): Promise<DobavljacNabavka[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("dobavljaci_nabavka", { p_od: od, p_do: do_ });
  if (error) throw new Error(`Učitavanje nabavke nije uspjelo: ${error.message}`);
  return (data as Record<string, unknown>[]).map((r) => ({
    dobavljac_id: String(r.dobavljac_id),
    naziv: String(r.naziv),
    aktivan: Boolean(r.aktivan),
    broj_isporuka: Number(r.broj_isporuka),
    ukupna_vrijednost: Number(r.ukupna_vrijednost),
    prosjecna_vrijednost: Number(r.prosjecna_vrijednost),
    prosjecan_razmak_dana: broj(r.prosjecan_razmak_dana),
    zadnja_isporuka: r.zadnja_isporuka === null ? null : String(r.zadnja_isporuka),
    stornirano: Number(r.stornirano),
  }));
}

export async function ucitajIsporuke(dobavljacId: string, od: string, do_: string): Promise<Isporuka[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("isporuke_dobavljaca", { p_dobavljac: dobavljacId, p_od: od, p_do: do_ });
  if (error) throw new Error(`Učitavanje isporuka nije uspjelo: ${error.message}`);
  return (data as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as Isporuka),
    vrijednost: Number(r.vrijednost),
    razmak_dana: broj(r.razmak_dana),
    stavke: (r.stavke as Record<string, unknown>[]).map((s) => ({
      artikal: String(s.artikal),
      mjera: String(s.mjera),
      kolicina: Number(s.kolicina),
      cijena: Number(s.cijena),
      vrijednost: Number(s.vrijednost),
      pakovanje: s.pakovanje === null ? null : String(s.pakovanje),
      kolicina_pakovanja: broj(s.kolicina_pakovanja),
    })),
  }));
}

export async function ucitajArtikleDobavljaca(dobavljacId: string, od: string, do_: string): Promise<ArtikalDobavljaca[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("artikli_dobavljaca", { p_dobavljac: dobavljacId, p_od: od, p_do: do_ });
  if (error) throw new Error(`Učitavanje artikala dobavljača nije uspjelo: ${error.message}`);
  return (data as Record<string, unknown>[]).map((r) => ({
    artikal_id: String(r.artikal_id),
    artikal: String(r.artikal),
    mjera: String(r.mjera),
    broj_isporuka: Number(r.broj_isporuka),
    kolicina: Number(r.kolicina),
    vrijednost: Number(r.vrijednost),
    zadnja_cijena: Number(r.zadnja_cijena),
    najnizja_cijena: Number(r.najnizja_cijena),
    najvisa_cijena: Number(r.najvisa_cijena),
    prosjecna_cijena: Number(r.prosjecna_cijena),
    zadnja_isporuka: String(r.zadnja_isporuka),
  }));
}
