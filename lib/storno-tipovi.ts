// Tipovi za storno; bez pristupa bazi, pa smiju i u klijentske komponente.

export type VrstaStorna = "prijem" | "izdavanje" | "otpis";

export type RadnjaZaStorno = {
  vrsta: VrstaStorna;
  id: string;
  vrijeme: string;
  opis: string;
  vrijednost: number | string;
  ime: string;
  stornirano: boolean;
  storno_razlog: string | null;
  storno_ime: string | null;
  storno_vrijeme: string | null;
};

export const NAZIV_VRSTE: Record<VrstaStorna, string> = {
  prijem: "Prijem",
  izdavanje: "Izdavanje",
  otpis: "Otpis",
};
