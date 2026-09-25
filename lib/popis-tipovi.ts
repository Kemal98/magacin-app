// Tipovi za popis magacina; bez pristupa bazi, pa smiju i u klijentske komponente.

export type RedPregleda = {
  artikal_id: string;
  naziv: string;
  mjera: string;
  sistem: number;
  brojano: number;
  razlika: number;
  /** Cijena kojom se razlika vrednuje; null ako je treba upisati (višak bez poznate cijene). */
  cijena: number | null;
  vrijednost_razlike: number;
  treba_cijenu: boolean;
};

export type StavkaPopisa = {
  artikal: string;
  mjera: string;
  sistem: number;
  brojano: number;
  razlika: number;
  cijena: number;
  vrijednost_razlike: number;
};

export type PopisMagacina = {
  id: string;
  vrijeme: string;
  ime: string;
  pocetno: boolean;
  vrijednost_razlike: number | string;
  stavke: StavkaPopisa[];
};
