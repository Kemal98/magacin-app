"use client";

import { useActionState, useState } from "react";
import { predloziIzExcela, sacuvajPopis } from "@/app/actions/popis-objekta";

type Artikal = { id: string; naziv: string; mjera: string; vrsta: string };

const VRSTA: Record<string, string> = { prehrana: "prehrana", materijal: "materijal" };

export function PopisArtikala({
  objekatId,
  artikli,
  izabrani,
}: {
  objekatId: string;
  artikli: Artikal[];
  izabrani: string[];
}) {
  const [oznaceni, setOznaceni] = useState(() => new Set(izabrani));
  const [trazi, setTrazi] = useState("");
  const [samoOznaceni, setSamoOznaceni] = useState(false);
  const [brojevi, setBrojevi] = useState<Map<string, number>>(new Map());
  const [snimanje, snimi, snima] = useActionState(sacuvajPopis.bind(null, objekatId), undefined);
  const [prijedlog, predlozi, ucitava] = useActionState(predloziIzExcela.bind(null, objekatId), undefined);

  const preklopi = (id: string) =>
    setOznaceni((stari) => {
      const novi = new Set(stari);
      if (novi.has(id)) novi.delete(id);
      else novi.add(id);
      return novi;
    });

  const primijeniPrijedlog = (zamijeni: boolean) => {
    if (!prijedlog || "greska" in prijedlog) return;
    const ids = prijedlog.prijedlog.artikli.map((a) => a.id);
    setOznaceni((stari) => new Set(zamijeni ? ids : [...stari, ...ids]));
    setBrojevi(new Map(prijedlog.prijedlog.artikli.map((a) => [a.id, a.brojUtrosaka])));
  };

  const vidljivi = artikli.filter(
    (a) =>
      (!samoOznaceni || oznaceni.has(a.id)) && a.naziv.toLowerCase().includes(trazi.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 shadow-sm bg-white">
        <h2 className="text-2xl font-semibold">Prijedlog iz starog Excela</h2>
        <p className="text-lg text-zinc-600">
          Izaberite <em>Utrošci - zalihe.xlsx</em>. Aplikacija nalazi artikle koje je ovaj objekat stvarno
          trošio. Prijedlog možete primijeniti, pa ispraviti ispod.
        </p>
        <form action={predlozi} className="flex flex-wrap items-center gap-3">
          <input type="file" name="fajl" accept=".xlsx" className="min-h-14 rounded-xl border-2 border-zinc-300 p-3 text-lg bg-white" />
          <button
            type="submit"
            disabled={ucitava}
            className="min-h-14 rounded-xl bg-brand px-6 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-50"
          >
            {ucitava ? "Čitam fajl…" : "Nađi prijedlog"}
          </button>
        </form>
        {prijedlog && "greska" in prijedlog && (
          <p role="alert" className="text-lg font-semibold text-red-700">
            {prijedlog.greska}
          </p>
        )}
        {prijedlog && "prijedlog" in prijedlog && (
          <div className="flex flex-col gap-3">
            <p className="text-xl">
              Objekat ima {prijedlog.prijedlog.brojUtrosaka} utrošaka u {prijedlog.prijedlog.artikli.length}{" "}
              različitih artikala.
            </p>
            {prijedlog.prijedlog.nepoznati.length > 0 && (
              <p className="text-lg text-zinc-600">
                Nisu u šifrarniku: {prijedlog.prijedlog.nepoznati.join(", ")}.
              </p>
            )}
            {prijedlog.prijedlog.artikli.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => primijeniPrijedlog(true)}
                  className="min-h-14 rounded-xl bg-green-700 px-5 text-lg font-semibold text-white active:bg-green-900"
                >
                  Zamijeni popis prijedlogom
                </button>
                <button
                  type="button"
                  onClick={() => primijeniPrijedlog(false)}
                  className="min-h-14 rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold active:bg-zinc-200 bg-white"
                >
                  Dodaj prijedlog na popis
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <form action={snimi} className="flex flex-col gap-4">
        {[...oznaceni].map((id) => (
          <input key={id} type="hidden" name="artikal" value={id} />
        ))}
        <p className="text-2xl font-bold">Na popisu: {oznaceni.size} artikala</p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            value={trazi}
            onChange={(e) => setTrazi(e.target.value)}
            placeholder="Traži artikal"
            aria-label="Traži artikal"
            className="min-h-14 flex-1 rounded-xl border-2 border-zinc-300 px-4 text-xl bg-white"
          />
          <label className="flex min-h-14 items-center gap-3 text-lg">
            <input type="checkbox" checked={samoOznaceni} onChange={(e) => setSamoOznaceni(e.target.checked)} className="size-6" />
            Samo artikli na popisu
          </label>
        </div>

        <ul className="flex flex-col gap-2">
          {vidljivi.map((a) => (
            <li key={a.id}>
              <label className="flex min-h-14 items-center gap-4 rounded-xl border-2 border-zinc-200 px-4 py-2 text-lg active:bg-zinc-100 bg-white">
                <input type="checkbox" checked={oznaceni.has(a.id)} onChange={() => preklopi(a.id)} className="size-7" />
                <span className="flex-1">
                  {a.naziv} <span className="text-zinc-500">({a.mjera}, {VRSTA[a.vrsta] ?? a.vrsta})</span>
                </span>
                {brojevi.has(a.id) && <span className="text-zinc-500">{brojevi.get(a.id)} utrošaka</span>}
              </label>
            </li>
          ))}
          {vidljivi.length === 0 && <li className="text-xl text-zinc-500">Nema artikala za prikaz.</li>}
        </ul>

        {snimanje?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {snimanje.greska}
          </p>
        )}
        <button
          type="submit"
          disabled={snima}
          className="min-h-16 rounded-2xl bg-brand text-2xl font-semibold text-white active:bg-brand-dark disabled:opacity-50"
        >
          {snima ? "Snimam…" : "Snimi popis"}
        </button>
      </form>
    </div>
  );
}
