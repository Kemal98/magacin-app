import Link from "next/link";
import { danasSarajevo, ovaGodina, period, sveVrijeme, zadnjihDana } from "@/lib/period";

const POLJE = "min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-4 text-xl";

/**
 * Izbor perioda (brze veze ili proizvoljni datumi). Radi bez skripte: običan obrazac (GET) i veze,
 * pa je izabrani pregled uvijek u adresi. `dodatno` su parametri koji se zadržavaju (npr. izabrani dobavljač).
 */
export function PeriodFilter({
  putanja,
  od,
  do: do_,
  dodatno = {},
}: {
  putanja: string;
  od: string;
  do: string;
  dodatno?: Record<string, string>;
}) {
  const danas = danasSarajevo();
  const veza = (p: { od: string; do: string }) => `${putanja}?${new URLSearchParams({ ...dodatno, od: p.od, do: p.do })}`;
  const brzi = [
    { naziv: "Ovaj mjesec", ...period("mjesec", danas) },
    { naziv: "Zadnjih 30 dana", ...zadnjihDana(30, danas) },
    { naziv: "Zadnjih 90 dana", ...zadnjihDana(90, danas) },
    { naziv: "Ova godina", ...ovaGodina(danas) },
    { naziv: "Sve vrijeme", ...sveVrijeme(danas) },
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
        {Object.entries(dodatno).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label className="flex flex-col gap-1 text-lg">
          Od
          <input type="date" name="od" defaultValue={od} required className={POLJE} />
        </label>
        <label className="flex flex-col gap-1 text-lg">
          Do
          <input type="date" name="do" defaultValue={do_} required className={POLJE} />
        </label>
        <button type="submit" className="min-h-14 rounded-xl bg-brand px-6 text-xl font-semibold text-white active:bg-brand-dark">
          Prikaži
        </button>
      </form>
    </section>
  );
}
