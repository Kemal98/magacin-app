"use client";

import { useActionState, useState } from "react";
import { poklapa } from "@/lib/pretraga";
import { dodajIzuzetak } from "@/app/actions/smjene";
import { kolicina as fmt } from "@/lib/format";

type Artikal = { id: string; naziv: string; mjera: string; moguce: number };

const RAZLOZI = ["Razbijeno", "Proliveno", "Isteklo", "Pokvareno"];

/** Izuzetak u toku smjene: artikal, količina i obavezan razlog; vodi se odvojeno od obične potrošnje. */
export function IzuzetakForma({ artikli }: { artikli: Artikal[] }) {
  const [stanje, akcija, radi] = useActionState(dodajIzuzetak, undefined);
  const [artikal, setArtikal] = useState("");
  const [trazi, setTrazi] = useState("");
  const [razlog, setRazlog] = useState("");
  const izabran = artikli.find((a) => a.id === artikal);
  const vidljivi = artikli.filter((a) => poklapa(a.naziv, trazi));

  if (artikli.length === 0) {
    return <p className="text-xl text-zinc-500">Nema artikala na zalihi objekta.</p>;
  }

  return (
    <form action={akcija} className="flex flex-col gap-5">
      <input type="hidden" name="artikal" value={artikal} />

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Artikal</h2>
        <input
          value={trazi}
          onChange={(e) => setTrazi(e.target.value)}
          placeholder="Traži artikal"
          aria-label="Traži artikal"
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-2xl bg-white"
        />
        <ul className="grid max-h-80 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
          {vidljivi.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setArtikal(a.id)}
                aria-pressed={artikal === a.id}
                className={`flex min-h-20 w-full flex-col items-start justify-center rounded-2xl border-2 p-3 text-left text-xl font-semibold active:bg-zinc-200 ${
                  artikal === a.id ? "border-brand bg-brand-soft" : "border-zinc-200 bg-white shadow-sm"
                }`}
              >
                <span>{a.naziv}</span>
                <span className="text-lg font-normal text-zinc-500">
                  na zalihi {fmt(a.moguce)} {a.mjera}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <label className="flex items-center gap-3 text-2xl font-semibold">
        Količina
        <input
          name="kolicina"
          inputMode="decimal"
          aria-label="Količina"
          className="min-h-16 w-32 rounded-xl border-2 border-zinc-300 px-3 text-center text-3xl font-bold bg-white"
        />
        <span>{izabran?.mjera}</span>
      </label>

      <section className="flex flex-col gap-3">
        <label htmlFor="razlog" className="text-2xl font-semibold">
          Razlog (obavezno)
        </label>
        <div className="flex flex-wrap gap-2">
          {RAZLOZI.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRazlog(r)}
              className="min-h-14 rounded-xl border-2 border-zinc-300 px-5 text-xl font-semibold active:bg-zinc-200 bg-white"
            >
              {r}
            </button>
          ))}
        </div>
        <input
          id="razlog"
          name="razlog"
          value={razlog}
          onChange={(e) => setRazlog(e.target.value)}
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-2xl bg-white"
        />
      </section>

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi || !artikal}
        className="min-h-20 rounded-2xl bg-amber-700 text-3xl font-bold text-white active:bg-amber-900 disabled:opacity-50"
      >
        {radi ? "Snimam…" : "Zabilježi izuzetak"}
      </button>
    </form>
  );
}
