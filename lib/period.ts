/**
 * Periodi za izvještaje. Datumi su tekst "GGGG-MM-DD" u lokalnom vremenu Sarajeva,
 * jer se dan, sedmica i mjesec računaju po lokalnom kalendaru.
 */

export type VrstaPerioda = "dan" | "sedmica" | "mjesec";

const OBLIK = /^\d{4}-\d{2}-\d{2}$/;

/** Danas po lokalnom vremenu Sarajeva. */
export function danasSarajevo(sada: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sarajevo" }).format(sada);
}

export function jeDatum(tekst: string | undefined): tekst is string {
  if (!tekst || !OBLIK.test(tekst)) return false;
  const d = new Date(`${tekst}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === tekst;
}

const uDatum = (d: Date) => d.toISOString().slice(0, 10);
const izDatuma = (tekst: string) => new Date(`${tekst}T00:00:00Z`);

/** Dan, sedmica (ponedjeljak do nedjelje) ili mjesec koji sadrži zadani datum. */
export function period(vrsta: VrstaPerioda, datum: string): { od: string; do: string } {
  const d = izDatuma(datum);
  if (vrsta === "dan") return { od: datum, do: datum };
  if (vrsta === "sedmica") {
    const danUSedmici = (d.getUTCDay() + 6) % 7; // ponedjeljak = 0
    const pocetak = new Date(d);
    pocetak.setUTCDate(d.getUTCDate() - danUSedmici);
    const kraj = new Date(pocetak);
    kraj.setUTCDate(pocetak.getUTCDate() + 6);
    return { od: uDatum(pocetak), do: uDatum(kraj) };
  }
  const pocetak = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const kraj = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { od: uDatum(pocetak), do: uDatum(kraj) };
}

/** Zadnjih n dana zaključno s danas. */
export function zadnjihDana(n: number, danas: string): { od: string; do: string } {
  const pocetak = izDatuma(danas);
  pocetak.setUTCDate(pocetak.getUTCDate() - (n - 1));
  return { od: uDatum(pocetak), do: danas };
}

/** Tekuća kalendarska godina do danas. */
export function ovaGodina(danas: string): { od: string; do: string } {
  return { od: `${danas.slice(0, 4)}-01-01`, do: danas };
}

/** Cijela historija (za pregled od početka rada). */
export function sveVrijeme(danas: string): { od: string; do: string } {
  return { od: "2000-01-01", do: danas };
}

/** Period iz parametara adrese; neispravan ili prazan unos daje zadani (tekući mjesec ako nije naveden drugi). */
export function periodIzParametara(
  od: string | undefined,
  do_: string | undefined,
  danas: string,
  zadano?: { od: string; do: string },
) {
  if (jeDatum(od) && jeDatum(do_) && od <= do_) return { od, do: do_ };
  return zadano ?? period("mjesec", danas);
}

/** Broj dana od datuma do danas (0 = danas). */
export function daniOd(datum: string, danas: string): number {
  return Math.round((izDatuma(danas).getTime() - izDatuma(datum).getTime()) / 86_400_000);
}
