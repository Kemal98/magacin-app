import { kolicina as fmt } from "@/lib/format";
import type { ZaNaruciti } from "@/lib/minimum";

/** Artikli ispod minimuma: šta i koliko treba naručiti da se vrati na minimum. */
export function ZaNarucitiPrikaz({ artikli }: { artikli: ZaNaruciti[] }) {
  if (artikli.length === 0) {
    return <p className="rounded-2xl bg-green-50 p-4 text-xl font-semibold text-green-900">Nijedan artikal nije ispod minimuma.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {artikli.map((a) => (
        <li
          key={a.artikal_id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4"
        >
          <div>
            <p className="text-2xl font-bold">{a.naziv}</p>
            <p className="text-lg text-zinc-600">
              Na stanju {fmt(Number(a.kolicina))} {a.mjera}, minimum {fmt(Number(a.minimum))} {a.mjera}
            </p>
          </div>
          <p className="text-2xl font-bold text-red-700">
            Nedostaje {fmt(Number(a.nedostaje))} {a.mjera}
          </p>
        </li>
      ))}
    </ul>
  );
}
