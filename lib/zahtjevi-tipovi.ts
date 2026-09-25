// Tipovi i nazivi za zahtjeve; bez pristupa bazi, pa smiju i u klijentske komponente.

export type StatusZahtjeva = "poslan" | "odobren" | "odbijen" | "na_dostavi";

export type StavkaZahtjeva = {
  id: string;
  artikal_id: string;
  naziv: string;
  mjera: string;
  bar_kod: string | null;
  pakovanje: string | null;
  pakovanje_bar_kod: string | null;
  faktor: number | null;
  trazena_kolicina: number;
  trazena_osnovna: number;
  odobrena_kolicina: number | null;
  odobrena_osnovna: number | null;
  izdana_kolicina: number | null;
  izdana_osnovna: number | null;
  /** Stanje magacina; vide ga samo magacioner i menadžer. */
  na_stanju: number | null;
};

export type Zahtjev = {
  id: string;
  vrijeme: string;
  status: StatusZahtjeva;
  objekat: string;
  poslao: string;
  odobrio: string | null;
  odluka_vrijeme: string | null;
  razlog: string | null;
  izdao: string | null;
  izdano_vrijeme: string | null;
  stavke: StavkaZahtjeva[];
};

export const NAZIV_STATUSA: Record<StatusZahtjeva, string> = {
  poslan: "Poslan, čeka odobrenje",
  odobren: "Odobren, čeka izdavanje",
  odbijen: "Odbijen",
  na_dostavi: "Na dostavi",
};
