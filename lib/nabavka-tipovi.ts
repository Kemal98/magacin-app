// Tipovi za evidenciju nabavke; bez pristupa bazi, pa smiju i u klijentske komponente i izvoz.

export type DobavljacNabavka = {
  dobavljac_id: string;
  naziv: string;
  aktivan: boolean;
  broj_isporuka: number;
  ukupna_vrijednost: number;
  prosjecna_vrijednost: number;
  /** Na koliko dana u prosjeku dolazi; null ako je došao manje od dva puta u periodu. */
  prosjecan_razmak_dana: number | null;
  /** Zadnji dolazak ikad (ne samo u periodu), "GGGG-MM-DD". */
  zadnja_isporuka: string | null;
  stornirano: number;
};

export type StavkaIsporuke = {
  artikal: string;
  mjera: string;
  kolicina: number;
  cijena: number;
  vrijednost: number;
  pakovanje: string | null;
  kolicina_pakovanja: number | null;
};

export type Isporuka = {
  id: string;
  datum_isporuke: string;
  /** Kad je isporuka unesena u sistem (može biti poslije datuma isporuke). */
  vrijeme: string;
  dokument: string | null;
  napomena: string | null;
  ime: string;
  vrijednost: number;
  razmak_dana: number | null;
  stornirano: boolean;
  storno_razlog: string | null;
  storno_ime: string | null;
  storno_vrijeme: string | null;
  stavke: StavkaIsporuke[];
};

export type ArtikalDobavljaca = {
  artikal_id: string;
  artikal: string;
  mjera: string;
  broj_isporuka: number;
  kolicina: number;
  vrijednost: number;
  zadnja_cijena: number;
  najnizja_cijena: number;
  najvisa_cijena: number;
  prosjecna_cijena: number;
  zadnja_isporuka: string;
};
