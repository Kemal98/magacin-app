import { datumVrijeme, km, kolicina as fmt } from "@/lib/format";
import type { ZatvorenaSmjena } from "@/lib/smjene-tipovi";

/** Zatvorena smjena: ko je zatvorio, šta je potrošeno po artiklu i (za menadžera) trošak. */
export function SmjenaKartica({ s, pokaziObjekat = false }: { s: ZatvorenaSmjena; pokaziObjekat?: boolean }) {
  const trosak = s.trosak === null ? null : Number(s.trosak);
  const trosakIzuzetaka = s.trosak_izuzetaka === null ? null : Number(s.trosak_izuzetaka);
  return (
    <li data-red className="flex flex-col gap-3 rounded-2xl border border-zinc-300 p-4 shadow-sm bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {pokaziObjekat && <p className="text-2xl font-bold">{s.objekat}</p>}
          <p className="text-xl font-semibold">
            {s.naziv ? `${s.naziv}, ` : "Smjena, "}
            {datumVrijeme(s.zatvorena)}
          </p>
          <p className="text-lg text-zinc-500">Zatvorio: {s.ime_osobe}</p>
        </div>
        {trosak !== null && (
          <div className="text-right text-xl">
            <p className="font-bold">Trošak potrošnje: {km(trosak)}</p>
            {trosakIzuzetaka !== null && trosakIzuzetaka > 0 && (
              <p className="font-semibold text-amber-800">Izuzeci: {km(trosakIzuzetaka)}</p>
            )}
          </div>
        )}
      </div>

      {s.stavke.length === 0 ? (
        <p className="text-lg text-zinc-500">Nije bilo robe za brojanje.</p>
      ) : (
        <table className="w-full text-left text-lg">
          <thead>
            <tr className="border-b-2 border-zinc-300">
              <th className="py-1">Artikal</th>
              <th className="py-1 text-right">Početno</th>
              <th className="py-1 text-right">Primljeno</th>
              <th className="py-1 text-right">Izuzeci</th>
              <th className="py-1 text-right">Završno</th>
              <th className="py-1 text-right">Potrošeno</th>
              {trosak !== null && <th className="py-1 text-right">Trošak</th>}
            </tr>
          </thead>
          <tbody>
            {s.stavke.map((st) => (
              <tr key={st.artikal} className="border-b border-zinc-200 align-top">
                <td className="py-1">
                  {st.artikal}
                  {st.visak > 0 && (
                    <span className="block text-base font-semibold text-amber-800">
                      Više nego moguće (+{fmt(Number(st.visak))} {st.mjera}): {st.razlog}
                    </span>
                  )}
                </td>
                <td className="py-1 text-right">{fmt(Number(st.pocetno))}</td>
                <td className="py-1 text-right">{fmt(Number(st.primljeno))}</td>
                <td className="py-1 text-right">{fmt(Number(st.izuzeci))}</td>
                <td className="py-1 text-right">{fmt(Number(st.zavrsno))}</td>
                <td className="py-1 text-right font-bold">
                  {fmt(Number(st.potrosnja))} {st.mjera}
                </td>
                {trosak !== null && (
                  <td className="py-1 text-right">
                    {km(Number(st.trosak ?? 0))}
                    {Number(st.trosak_izuzetaka ?? 0) > 0 && (
                      <span className="block text-base text-amber-800">+ {km(Number(st.trosak_izuzetaka))} izuzeci</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
