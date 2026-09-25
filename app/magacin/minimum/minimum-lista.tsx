"use client";

import { useActionState, useState } from "react";
import { poklapa } from "@/lib/pretraga";
import { postaviMinimum } from "@/app/actions/minimum";
import { kolicina as fmt } from "@/lib/format";

type Artikal = { id: string; naziv: string; mjera: string; kolicina: number; minimum: number };

export function MinimumLista({ artikli }: { artikli: Artikal[] }) {
  const [trazi, setTrazi] = useState("");
  const vidljivi = artikli.filter((a) => poklapa(a.naziv, trazi));
  return (
    <div className="flex flex-col gap-4">
      <input
        value={trazi}
        onChange={(e) => setTrazi(e.target.value)}
        placeholder="Traži artikal"
        aria-label="Traži artikal"
        className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl"
      />
      <ul className="flex flex-col gap-2">
        {vidljivi.map((a) => (
          <Red key={a.id} a={a} />
        ))}
        {vidljivi.length === 0 && <li className="text-xl text-zinc-500">Nema artikala za prikaz.</li>}
      </ul>
    </div>
  );
}

/** Jedan artikal: minimum se snima zasebno, dugmetom uz polje. */
function Red({ a }: { a: Artikal }) {
  const [stanje, akcija, radi] = useActionState(postaviMinimum.bind(null, a.id), undefined);
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <form action={akcija} className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <p className="text-xl font-semibold">{a.naziv}</p>
          <p className="text-lg text-zinc-500">
            Na stanju: {fmt(a.kolicina)} {a.mjera}
          </p>
        </div>
        <label className="flex items-center gap-2 text-lg">
          Minimum
          <input
            name="minimum"
            defaultValue={a.minimum > 0 ? String(a.minimum) : ""}
            inputMode="decimal"
            aria-label={`Minimum ${a.naziv}`}
            className="min-h-14 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-2xl font-bold"
          />
          <span className="w-8 text-zinc-500">{a.mjera}</span>
        </label>
        <button
          type="submit"
          disabled={radi}
          className="min-h-14 rounded-xl bg-brand px-5 text-lg font-semibold text-white active:bg-brand-dark disabled:opacity-50"
        >
          {radi ? "…" : "Snimi"}
        </button>
        {stanje?.snimljeno && <span className="text-lg font-semibold text-green-800">Snimljeno</span>}
        {stanje?.greska && (
          <span role="alert" className="text-lg font-semibold text-red-700">
            {stanje.greska}
          </span>
        )}
      </form>
    </li>
  );
}
