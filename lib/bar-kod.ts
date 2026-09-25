/**
 * Traženje artikla po unosu: skener (radi kao tastatura i šalje kod), kamera ili ručno kucanje.
 * Zajedničko za sve ekrane koji biraju artikal (prijem, izdavanje, popis).
 */

export type PakovanjeZaUnos = {
  id: string;
  naziv: string;
  faktor: number;
  bar_kod?: string | null;
};

export type ArtikalZaUnos = {
  id: string;
  naziv: string;
  mjera: string;
  bar_kod: string | null;
  pakovanja: PakovanjeZaUnos[];
};

export type Rezultat =
  | { status: "nadjen"; artikal: ArtikalZaUnos; pakovanjeId: string | null }
  | { status: "nepoznat_kod"; kod: string }
  | { status: "nepoznat_naziv"; tekst: string }
  | { status: "prazno" };

// EAN-8, EAN-13, UPC i slični kodovi su samo cifre.
const IZGLEDA_KAO_KOD = /^\d{6,}$/;

/** Prvo bar kod artikla ili pakovanja, zatim tačan naziv. */
export function pretrazi(artikli: ArtikalZaUnos[], unos: string): Rezultat {
  const tekst = unos.trim();
  if (!tekst) return { status: "prazno" };

  for (const artikal of artikli) {
    if (artikal.bar_kod?.trim() === tekst) return { status: "nadjen", artikal, pakovanjeId: null };
    const pak = artikal.pakovanja.find((p) => p.bar_kod?.trim() === tekst);
    if (pak) return { status: "nadjen", artikal, pakovanjeId: pak.id };
  }

  const naziv = tekst.toLowerCase();
  const poNazivu = artikli.find((a) => a.naziv.trim().toLowerCase() === naziv);
  if (poNazivu) return { status: "nadjen", artikal: poNazivu, pakovanjeId: null };

  return IZGLEDA_KAO_KOD.test(tekst)
    ? { status: "nepoznat_kod", kod: tekst }
    : { status: "nepoznat_naziv", tekst };
}
