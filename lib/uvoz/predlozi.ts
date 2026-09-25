import { kljuc, ocistiObjekat } from "./ocisti";
import { procitajVelikiList } from "./xlsx";

export type Utrosak = { objekat: string; artikal: string };

export type PrijedlogPopisa = {
  /** Artikli iz šifrarnika koje je objekat trošio, najčešći prvi. */
  artikli: { id: string; naziv: string; brojUtrosaka: number }[];
  /** Nazivi iz utrošaka kojih nema u šifrarniku (pravopis, stari artikli). */
  nepoznati: string[];
  brojUtrosaka: number;
};

/**
 * Prijedlog popisa artikala objekta iz historije utrošaka u starom Excelu:
 * artikli koje je objekat stvarno trošio. Menadžer ga pregleda i ispravlja.
 */
export function predloziPopis(
  utrosci: Utrosak[],
  objekat: string,
  sifrarnik: { id: string; naziv: string }[],
): PrijedlogPopisa {
  const cilj = kljuc(ocistiObjekat(objekat));
  const poNazivu = new Map(sifrarnik.map((a) => [kljuc(a.naziv), a]));
  const brojevi = new Map<string, number>();
  const nepoznati = new Set<string>();
  let brojUtrosaka = 0;

  for (const u of utrosci) {
    if (kljuc(ocistiObjekat(u.objekat)) !== cilj) continue;
    brojUtrosaka++;
    const artikal = poNazivu.get(kljuc(u.artikal));
    if (artikal) brojevi.set(artikal.id, (brojevi.get(artikal.id) ?? 0) + 1);
    else if (u.artikal.trim()) nepoznati.add(u.artikal.trim());
  }

  const artikli = [...brojevi]
    .map(([id, brojUtrosaka]) => ({ id, naziv: sifrarnik.find((a) => a.id === id)!.naziv, brojUtrosaka }))
    .sort((a, b) => b.brojUtrosaka - a.brojUtrosaka || a.naziv.localeCompare(b.naziv, "bs"));
  return { artikli, nepoznati: [...nepoznati].sort(), brojUtrosaka };
}

/** Utrošci iz lista UTROŠCI (kolona B = objekat, C = naziv artikla). */
export function procitajUtroske(fajl: Uint8Array): Utrosak[] {
  return procitajVelikiList(fajl, "UTROŠCI", ["B", "C"])
    .slice(1) // zaglavlje
    .filter((r) => r.B && r.C)
    .map((r) => ({ objekat: r.B, artikal: r.C }));
}
