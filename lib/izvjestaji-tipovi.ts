// Tipovi i zbirovi za izvještaje po objektima; bez pristupa bazi, pa se mogu testirati i koristiti svuda.

export type RedIzvjestaja = {
  objekat_id: string;
  objekat: string;
  artikal_id: string;
  artikal: string;
  mjera: string;
  izdato: number;
  manjak: number;
  potroseno: number;
  izuzeci: number;
  visak: number;
  razlika: number;
  promjena_zalihe: number;
  zaliha_sada: number;
  vrijednost_izdatog: number;
  trosak_potrosnje: number;
  trosak_izuzetaka: number;
};

export type Zbir = {
  vrijednost_izdatog: number;
  trosak_potrosnje: number;
  trosak_izuzetaka: number;
};

/** Ukupan trošak = obična potrošnja + izuzeci. */
export const ukupanTrosak = (z: { trosak_potrosnje: number; trosak_izuzetaka: number }) =>
  z.trosak_potrosnje + z.trosak_izuzetaka;

export function zbir(redovi: Zbir[]): Zbir {
  return redovi.reduce(
    (z, r) => ({
      vrijednost_izdatog: z.vrijednost_izdatog + r.vrijednost_izdatog,
      trosak_potrosnje: z.trosak_potrosnje + r.trosak_potrosnje,
      trosak_izuzetaka: z.trosak_izuzetaka + r.trosak_izuzetaka,
    }),
    { vrijednost_izdatog: 0, trosak_potrosnje: 0, trosak_izuzetaka: 0 },
  );
}

export type GrupaObjekta = { objekat_id: string; objekat: string; redovi: RedIzvjestaja[]; zbir: Zbir };

/** Redovi po objektu, objekti s najvećim ukupnim troškom prvi. */
export function poObjektu(redovi: RedIzvjestaja[]): GrupaObjekta[] {
  const grupe = new Map<string, GrupaObjekta>();
  for (const r of redovi) {
    const g = grupe.get(r.objekat_id) ?? { objekat_id: r.objekat_id, objekat: r.objekat, redovi: [], zbir: zbir([]) };
    g.redovi.push(r);
    grupe.set(r.objekat_id, g);
  }
  const lista = [...grupe.values()].map((g) => ({
    ...g,
    zbir: zbir(g.redovi),
    redovi: [...g.redovi].sort((a, b) => ukupanTrosak(b) - ukupanTrosak(a) || a.artikal.localeCompare(b.artikal, "bs")),
  }));
  return lista.sort((a, b) => ukupanTrosak(b.zbir) - ukupanTrosak(a.zbir) || a.objekat.localeCompare(b.objekat, "bs"));
}

export type RedArtikla = {
  artikal_id: string;
  artikal: string;
  mjera: string;
  izdato: number;
  potroseno: number;
  izuzeci: number;
  trosak_potrosnje: number;
  trosak_izuzetaka: number;
};

/** Potrošnja po artiklu za sve objekte zajedno, najskuplji prvi. */
export function poArtiklu(redovi: RedIzvjestaja[]): RedArtikla[] {
  const artikli = new Map<string, RedArtikla>();
  for (const r of redovi) {
    const a =
      artikli.get(r.artikal_id) ??
      { artikal_id: r.artikal_id, artikal: r.artikal, mjera: r.mjera, izdato: 0, potroseno: 0, izuzeci: 0, trosak_potrosnje: 0, trosak_izuzetaka: 0 };
    a.izdato += r.izdato;
    a.potroseno += r.potroseno;
    a.izuzeci += r.izuzeci;
    a.trosak_potrosnje += r.trosak_potrosnje;
    a.trosak_izuzetaka += r.trosak_izuzetaka;
    artikli.set(r.artikal_id, a);
  }
  return [...artikli.values()].sort(
    (a, b) => ukupanTrosak(b) - ukupanTrosak(a) || a.artikal.localeCompare(b.artikal, "bs"),
  );
}
