"use client";

import { useActionState, useState } from "react";
import { sacuvajRaspored } from "@/app/actions/smjene";

type Red = { naziv: string; pocetak: string; kraj: string };
const POLJE = "min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl";

/** Smjene objekta: naziv i satnica (početak i kraj; smjena može ići preko ponoći). */
export function RasporedForma({ objekatId, pocetni }: { objekatId: string; pocetni: Red[] }) {
  const [stanje, akcija, radi] = useActionState(sacuvajRaspored.bind(null, objekatId), undefined);
  const [redovi, setRedovi] = useState<Red[]>(pocetni);

  const izmijeni = (i: number, polje: keyof Red, v: string) =>
    setRedovi((stari) => stari.map((r, j) => (j === i ? { ...r, [polje]: v } : r)));

  return (
    <form action={akcija} className="flex flex-col gap-4">
      <p className="text-lg text-zinc-600">
        Zadajte smjene i njihove satnice. Objekat vidi trenutnu smjenu, a zatvorena smjena pamti svoj naziv.
      </p>
      {redovi.length === 0 && <p className="text-xl text-zinc-500">Nema zadanih smjena.</p>}
      {redovi.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-zinc-200 p-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-lg">
            Naziv
            <input name="naziv" value={r.naziv} onChange={(e) => izmijeni(i, "naziv", e.target.value)} className={POLJE} />
          </label>
          <label className="flex flex-col gap-1 text-lg">
            Od
            <input name="pocetak" type="time" value={r.pocetak} onChange={(e) => izmijeni(i, "pocetak", e.target.value)} className={POLJE} />
          </label>
          <label className="flex flex-col gap-1 text-lg">
            Do
            <input name="kraj" type="time" value={r.kraj} onChange={(e) => izmijeni(i, "kraj", e.target.value)} className={POLJE} />
          </label>
          <button
            type="button"
            onClick={() => setRedovi((stari) => stari.filter((_, j) => j !== i))}
            className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
          >
            Ukloni
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRedovi((stari) => [...stari, { naziv: "", pocetak: "", kraj: "" }])}
        className="min-h-14 self-start rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold active:bg-zinc-200"
      >
        + Dodaj smjenu
      </button>
      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi}
        className="min-h-16 rounded-2xl bg-zinc-900 text-2xl font-semibold text-white active:bg-zinc-700 disabled:opacity-50"
      >
        {radi ? "Snimam…" : "Snimi smjene"}
      </button>
    </form>
  );
}
