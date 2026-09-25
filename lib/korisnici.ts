import type { Uloga } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type KorisnikZaUpravljanje = {
  id: string;
  ime: string;
  uloga: Uloga;
  aktivan: boolean;
  objekat_id: string | null;
  objekat: string | null;
  /** E-adresa samo za menadžere; ostali se prijavljuju PIN-om. */
  email: string | null;
  neuspjesnih: number;
  /** Do kada je račun zaključan zbog pogrešnih PIN-ova; null ako nije. */
  zakljucan_do: string | null;
};

/** Svi korisnici za ekran upravljanja; samo menadžer. */
export async function ucitajKorisnike(): Promise<KorisnikZaUpravljanje[]> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("korisnici_pregled");
  if (error) throw new Error(`Učitavanje korisnika nije uspjelo: ${error.message}`);
  return data as KorisnikZaUpravljanje[];
}
