import { datumVrijeme, km, kolicina as fmt } from "@/lib/format";
import type { Otpis } from "@/lib/otpis";

/** Otpisi magacina s razlogom, vrijednošću, imenom osobe i vremenom. */
export function OtpisiPrikaz({ otpisi }: { otpisi: Otpis[] }) {
  if (otpisi.length === 0) return <p className="text-xl text-zinc-500">Još nema otpisa.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {otpisi.map((o, i) => (
        <li key={`${o.vrijeme}-${i}`} className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-bold">
              {o.artikal}: {fmt(Number(o.kolicina))} {o.mjera}
            </p>
            <p className="text-xl font-bold text-red-700">{km(Number(o.vrijednost))}</p>
          </div>
          <p className="text-xl">Razlog: {o.razlog}</p>
          <p className="text-lg text-zinc-500">
            {o.ime}, {datumVrijeme(o.vrijeme)} · po prosječnoj cijeni {km(Number(o.cijena))}
          </p>
        </li>
      ))}
    </ul>
  );
}
