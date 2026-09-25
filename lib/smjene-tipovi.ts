// Tipovi za smjene; bez pristupa bazi, pa smiju i u klijentske komponente.

export type RedZaZatvaranje = {
  artikal_id: string;
  naziv: string;
  mjera: string;
  bar_kod: string | null;
  pocetno: number;
  primljeno: number;
  izuzeci: number;
  /** Koliko po sistemu treba biti u objektu (bez robe koja je još na dostavi). */
  moguce: number;
};

export type StavkaSmjene = {
  artikal: string;
  mjera: string;
  pocetno: number;
  primljeno: number;
  izuzeci: number;
  zavrsno: number;
  potrosnja: number;
  visak: number;
  razlog: string | null;
  /** Trošak vidi samo menadžer; objekat dobija null. */
  trosak: number | null;
  trosak_izuzetaka: number | null;
};

export type ZatvorenaSmjena = {
  id: string;
  objekat: string;
  naziv: string | null;
  ime_osobe: string;
  zatvorena: string;
  trosak: number | string | null;
  trosak_izuzetaka: number | string | null;
  stavke: StavkaSmjene[];
};

export type UpozorenjeSmjene = {
  smjena_id: string;
  zatvorena: string;
  objekat: string;
  ime_osobe: string;
  artikal: string;
  mjera: string;
  visak: number | string;
  razlog: string;
  vrijednost: number | string;
};

export type Izuzetak = {
  vrijeme: string;
  artikal: string;
  mjera: string;
  kolicina: number | string;
  razlog: string;
};

export type TerminSmjene = { id: string; naziv: string; pocetak: string; kraj: string };
