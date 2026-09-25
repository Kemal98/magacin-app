import { datumVrijeme, km, kolicina } from "@/lib/format";
import type { Razlika } from "@/lib/razlike";

/** Razlike koje su objekti prijavili pri prijemu robe: šta je poslano, šta je stiglo i koliko vrijedi manjak. */
export function RazlikePrikaz({ razlike }: { razlike: Razlika[] }) {
  if (razlike.length === 0) {
    return <p className="text-xl text-zinc-500">Nema prijavljenih razlika pri prijemu.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {razlike.map((r, i) => (
        <li data-red key={`${r.zahtjev_id}-${r.artikal}-${i}`} className="rounded-2xl border border-red-300 bg-red-50 p-4 text-xl shadow-sm">
          <p className="font-bold">
            {r.objekat}: {r.artikal}
          </p>
          <p>
            Poslano {kolicina(Number(r.izdano))} {r.mjera}, stiglo {kolicina(Number(r.primljeno))} {r.mjera}{" "}
            <span className="font-bold text-red-700">
              (razlika {kolicina(Number(r.razlika))} {r.mjera}, {km(Number(r.vrijednost_razlike))})
            </span>
          </p>
          <p className="text-lg text-zinc-600">
            Potvrdio: {r.primio}, {datumVrijeme(r.vrijeme)}
          </p>
        </li>
      ))}
    </ul>
  );
}
