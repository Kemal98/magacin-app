import { datumVrijeme, km, kolicina as fmt } from "@/lib/format";
import type { PopisMagacina } from "@/lib/popis-tipovi";

/** Popisi magacina: ko je popisivao, kada, koje su razlike i koliko vrijede. */
export function PopisiPrikaz({ popisi }: { popisi: PopisMagacina[] }) {
  if (popisi.length === 0) return <p className="text-xl text-zinc-500">Još nema popisa.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {popisi.map((p) => {
        const razlike = p.stavke.filter((s) => Number(s.razlika) !== 0);
        const vrijednost = Number(p.vrijednost_razlike);
        return (
          <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xl font-bold">
                  {datumVrijeme(p.vrijeme)}
                  {p.pocetno && (
                    <span className="ml-2 rounded-full bg-brand-soft px-3 py-0.5 text-base font-semibold text-brand">
                      početno stanje
                    </span>
                  )}
                </p>
                <p className="text-lg text-zinc-500">Popisao: {p.ime} · izbrojano artikala: {p.stavke.length}</p>
              </div>
              <p className={`text-xl font-bold ${vrijednost < 0 ? "text-red-700" : vrijednost > 0 ? "text-green-800" : ""}`}>
                Razlika: {km(vrijednost)}
              </p>
            </div>
            {razlike.length === 0 ? (
              <p className="text-lg text-zinc-500">Stanje se poklapalo, nije bilo razlika.</p>
            ) : (
              <table className="w-full text-left text-lg">
                <thead>
                  <tr className="border-b-2 border-zinc-300">
                    <th className="py-1">Artikal</th>
                    <th className="py-1 text-right">Sistem</th>
                    <th className="py-1 text-right">Brojano</th>
                    <th className="py-1 text-right">Razlika</th>
                    <th className="py-1 text-right">Vrijednost</th>
                  </tr>
                </thead>
                <tbody>
                  {razlike.map((s) => (
                    <tr key={s.artikal} className="border-b border-zinc-200">
                      <td className="py-1">{s.artikal}</td>
                      <td className="py-1 text-right">{fmt(Number(s.sistem))}</td>
                      <td className="py-1 text-right">{fmt(Number(s.brojano))}</td>
                      <td className={`py-1 text-right font-bold ${Number(s.razlika) < 0 ? "text-red-700" : "text-green-800"}`}>
                        {Number(s.razlika) > 0 ? "+" : ""}
                        {fmt(Number(s.razlika))} {s.mjera}
                      </td>
                      <td className="py-1 text-right">{km(Number(s.vrijednost_razlike))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        );
      })}
    </ul>
  );
}
