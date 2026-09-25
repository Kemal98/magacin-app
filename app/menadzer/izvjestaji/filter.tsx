import Link from "next/link";
import { danasSarajevo, period } from "@/lib/period";

const POLJE = "min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-4 text-xl";

/**
 * Izbor perioda (dan, sedmica, mjesec ili proizvoljno) i objekta. Radi bez skripte: običan obrazac
 * (GET) i veze, pa je izabrani izvještaj uvijek u adresi i može se sačuvati ili poslati.
 */
export function IzvjestajFilter({
  putanja,
  od,
  do: do_,
  objekat,
  objekti,
}: {
  putanja: string;
  od: string;
  do: string;
  objekat?: string;
  objekti: { id: string; naziv: string }[];
}) {
  const danas = danasSarajevo();
  const veza = (p: { od: string; do: string }) => {
    const q = new URLSearchParams({ od: p.od, do: p.do });
    if (objekat) q.set("objekat", objekat);
    return `${putanja}?${q.toString()}`;
  };
  const brzi = [
    { naziv: "Danas", ...period("dan", danas) },
    { naziv: "Ova sedmica", ...period("sedmica", danas) },
    { naziv: "Ovaj mjesec", ...period("mjesec", danas) },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {brzi.map((b) => {
          const aktivno = b.od === od && b.do === do_;
          return (
            <Link
              key={b.naziv}
              href={veza(b)}
              aria-current={aktivno ? "true" : undefined}
              className={`flex min-h-12 items-center rounded-xl border-2 px-5 text-lg font-semibold ${
                aktivno ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white active:bg-zinc-200"
              }`}
            >
              {b.naziv}
            </Link>
          );
        })}
      </div>
      <form action={putanja} method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-lg">
          Od
          <input type="date" name="od" defaultValue={od} required className={POLJE} />
        </label>
        <label className="flex flex-col gap-1 text-lg">
          Do
          <input type="date" name="do" defaultValue={do_} required className={POLJE} />
        </label>
        <label className="flex flex-col gap-1 text-lg">
          Objekat
          <select name="objekat" defaultValue={objekat ?? ""} className={POLJE}>
            <option value="">Svi objekti</option>
            {objekti.map((o) => (
              <option key={o.id} value={o.id}>
                {o.naziv}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-14 rounded-xl bg-brand px-6 text-xl font-semibold text-white active:bg-brand-dark"
        >
          Prikaži
        </button>
      </form>
    </section>
  );
}

/** Prebacivanje između pogleda izvještaja uz zadržavanje perioda i objekta. */
export function IzvjestajKartice({
  aktivno,
  od,
  do: do_,
  objekat,
}: {
  aktivno: "trosak" | "izdato";
  od: string;
  do: string;
  objekat?: string;
}) {
  const q = new URLSearchParams({ od, do: do_ });
  if (objekat) q.set("objekat", objekat);
  const kartice = [
    { kljuc: "trosak", naziv: "Trošak i potrošnja", href: `/menadzer/izvjestaji?${q}` },
    { kljuc: "izdato", naziv: "Izdato / potrošeno / zaliha", href: `/menadzer/izvjestaji/izdato?${q}` },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Pogled izvještaja">
      {kartice.map((k) => (
        <Link
          key={k.kljuc}
          href={k.href}
          aria-current={aktivno === k.kljuc ? "page" : undefined}
          className={`flex min-h-14 items-center rounded-xl px-5 text-xl font-bold ${
            aktivno === k.kljuc ? "bg-brand text-white" : "border-2 border-brand text-brand active:bg-brand-soft"
          }`}
        >
          {k.naziv}
        </Link>
      ))}
    </nav>
  );
}
