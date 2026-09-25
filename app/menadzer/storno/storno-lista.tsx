"use client";

import { useActionState, useState } from "react";
import { stornirajRadnju } from "@/app/actions/storno";
import { datumVrijeme, km } from "@/lib/format";
import { NAZIV_VRSTE, type RadnjaZaStorno, type VrstaStorna } from "@/lib/storno-tipovi";

const FILTRI: { vrijednost: VrstaStorna | "sve"; naziv: string }[] = [
  { vrijednost: "sve", naziv: "Sve" },
  { vrijednost: "prijem", naziv: "Prijemi" },
  { vrijednost: "izdavanje", naziv: "Izdavanja" },
  { vrijednost: "otpis", naziv: "Otpisi" },
];

export function StornoLista({ radnje }: { radnje: RadnjaZaStorno[] }) {
  const [filter, setFilter] = useState<VrstaStorna | "sve">("sve");
  const vidljive = radnje.filter((r) => filter === "sve" || r.vrsta === filter);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vrsta radnje">
        {FILTRI.map((f) => (
          <button
            key={f.vrijednost}
            type="button"
            onClick={() => setFilter(f.vrijednost)}
            aria-pressed={filter === f.vrijednost}
            className={`min-h-12 rounded-xl border-2 px-5 text-lg font-semibold ${
              filter === f.vrijednost ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white"
            }`}
          >
            {f.naziv}
          </button>
        ))}
      </div>
      {vidljive.length === 0 ? (
        <p className="text-xl text-zinc-500">Nema radnji za prikaz.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {vidljive.map((r) => (
            <StornoKartica key={`${r.vrsta}-${r.id}`} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StornoKartica({ r }: { r: RadnjaZaStorno }) {
  const [stanje, akcija, radi] = useActionState(stornirajRadnju.bind(null, r.vrsta, r.id), undefined);
  const [otvoreno, setOtvoreno] = useState(false);

  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm ${
        r.stornirano ? "border-zinc-300 bg-zinc-100" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={r.stornirano ? "text-zinc-500" : ""}>
          <p className="text-xl font-bold">
            <span className="mr-2 rounded-full bg-brand-soft px-3 py-0.5 text-base font-semibold text-brand">
              {NAZIV_VRSTE[r.vrsta]}
            </span>
            <span className={r.stornirano ? "line-through" : ""}>{r.opis}</span>
          </p>
          <p className="text-lg">
            {km(Number(r.vrijednost))} · {r.ime}, {datumVrijeme(r.vrijeme)}
          </p>
        </div>
        {!r.stornirano && !otvoreno && (
          <button
            type="button"
            onClick={() => setOtvoreno(true)}
            className="min-h-14 rounded-xl border-2 border-red-700 bg-white px-5 text-lg font-bold text-red-800 active:bg-red-50"
          >
            Poništi
          </button>
        )}
      </div>

      {r.stornirano && (
        <p className="rounded-xl bg-white p-3 text-lg font-semibold text-red-800">
          STORNIRANO: {r.storno_razlog}
          <span className="block text-base font-normal text-zinc-600">
            {r.storno_ime}
            {r.storno_vrijeme && `, ${datumVrijeme(r.storno_vrijeme)}`}
          </span>
        </p>
      )}

      {otvoreno && (
        <form action={akcija} className="flex flex-col gap-3 rounded-xl border-2 border-red-700 p-3">
          <label className="flex flex-col gap-1 text-lg font-semibold">
            Razlog poništavanja (obavezno)
            <input
              name="razlog"
              autoFocus
              className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl font-normal"
            />
          </label>
          {stanje?.greska && (
            <p role="alert" className="text-lg font-semibold text-red-700">
              {stanje.greska}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={radi}
              className="min-h-14 rounded-xl bg-red-700 px-6 text-xl font-bold text-white active:bg-red-900 disabled:opacity-50"
            >
              {radi ? "Poništavam…" : "Potvrdi storno"}
            </button>
            <button
              type="button"
              onClick={() => setOtvoreno(false)}
              className="min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-6 text-xl font-semibold active:bg-zinc-200"
            >
              Odustani
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
