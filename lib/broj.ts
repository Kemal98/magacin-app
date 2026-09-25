/** Broj iz forme; dozvoljava i zarez kao decimalni znak. Prazno je NaN. */
export function broj(tekst: string): number {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
}
