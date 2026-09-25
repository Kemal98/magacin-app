// Tipovi i nazivi za zahtjeve; bez pristupa bazi, pa smiju i u klijentske komponente.

export type StatusZahtjeva = "poslan" | "odobren" | "odbijen";

export type StavkaZahtjeva = {
  id: string;
  artikal_id: string;
  naziv: string;
  mjera: string;
  pakovanje: string | null;
  faktor: number | null;
  trazena_kolicina: number;
  trazena_osnovna: number;
  odobrena_kolicina: number | null;
  odobrena_osnovna: number | null;
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
  stavke: StavkaZahtjeva[];
};

export const NAZIV_STATUSA: Record<StatusZahtjeva, string> = {
  poslan: "Poslan, čeka odobrenje",
  odobren: "Odobren",
  odbijen: "Odbijen",
};
