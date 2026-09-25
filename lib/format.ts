/** Iznos u KM, npr. "1.234,50 KM". */
export function km(iznos: number): string {
  return `${iznos.toLocaleString("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`;
}

/** Količina bez suvišnih nula, npr. "12,5" ili "30". */
export function kolicina(v: number): string {
  return v.toLocaleString("bs-BA", { maximumFractionDigits: 3 });
}

export function datumVrijeme(iso: string): string {
  return new Date(iso).toLocaleString("bs-BA", { dateStyle: "short", timeStyle: "short" });
}
