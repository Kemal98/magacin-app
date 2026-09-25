import { napraviServerKlijent } from "@/lib/supabase/server";
import type {
  Izuzetak,
  RedZaZatvaranje,
  TerminSmjene,
  UpozorenjeSmjene,
  ZatvorenaSmjena,
} from "@/lib/smjene-tipovi";

async function pozovi<T>(ime: string, argumenti?: Record<string, unknown>): Promise<T> {
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc(ime, argumenti);
  if (error) throw new Error(`Učitavanje nije uspjelo (${ime}): ${error.message}`);
  return data as T;
}

/** Stanje za ekran zatvaranja smjene (objekat). */
export async function ucitajStanjeZaZatvaranje(): Promise<RedZaZatvaranje[]> {
  const redovi = await pozovi<Record<string, string | number | null>[]>("stanje_za_zatvaranje");
  return redovi.map((r) => ({
    artikal_id: String(r.artikal_id),
    naziv: String(r.naziv),
    mjera: String(r.mjera),
    bar_kod: r.bar_kod === null ? null : String(r.bar_kod),
    pocetno: Number(r.pocetno),
    primljeno: Number(r.primljeno),
    izuzeci: Number(r.izuzeci),
    moguce: Number(r.moguce),
  }));
}

export async function ucitajSmjene(objekatId?: string, limit = 20): Promise<ZatvorenaSmjena[]> {
  return pozovi<ZatvorenaSmjena[]>("smjene_objekta", { p_objekat: objekatId ?? null, p_limit: limit });
}

export const ucitajUpozorenja = (limit = 50) => pozovi<UpozorenjeSmjene[]>("upozorenja_smjena", { p_limit: limit });

export const ucitajIzuzetke = () => pozovi<Izuzetak[]>("izuzeci_tekuce_smjene");

export const ucitajRaspored = (objekatId?: string) =>
  pozovi<TerminSmjene[]>("smjene_raspored", { p_objekat: objekatId ?? null });

/** Smjena koja sada traje (prazno ako raspored nije zadan ili je trenutak van svih smjena). */
export async function ucitajTrenutnuSmjenu(objekatId?: string) {
  const r = await pozovi<{ naziv: string; pocetak: string; kraj: string }[]>("trenutna_smjena", {
    p_objekat: objekatId ?? null,
  });
  return r[0] ?? null;
}
