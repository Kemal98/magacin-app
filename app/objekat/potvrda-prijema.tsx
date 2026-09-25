"use client";

import { useActionState, useState } from "react";
import { potvrdiPrimljeno } from "@/app/actions/zahtjevi";
import { kolicinaTekst } from "@/app/_components/zahtjev-prikaz";
import { datumVrijeme } from "@/lib/format";
import type { Zahtjev } from "@/lib/zahtjevi-tipovi";

/**
 * Roba je na dostavi: jedan veliki dodir "STIGLO" potvrđuje da je sve stiglo kako je poslano.
 * Ako je stiglo drugačije, upisuje se stvarna količina po stavci.
 */
export function PotvrdaPrijema({ z }: { z: Zahtjev }) {
  const [stanje, akcija, radi] = useActionState(potvrdiPrimljeno.bind(null, z.id), undefined);
  const [drugacije, setDrugacije] = useState(false);

  return (
    <li className="flex flex-col gap-4 rounded-2xl border-4 border-blue-700 p-4">
      <div>
        <p className="text-2xl font-bold">Roba je na putu</p>
        <p className="text-lg text-zinc-500">
          Izdao: {z.izdao}
          {z.izdano_vrijeme && `, ${datumVrijeme(z.izdano_vrijeme)}`}
        </p>
      </div>

      <form action={akcija} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3 text-2xl">
          {z.stavke
            .filter((s) => (s.izdana_osnovna ?? 0) > 0)
            .map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-48 flex-1">
                  <span className="font-semibold">{s.naziv}</span>
                  <br />
                  <span className="text-xl text-zinc-600">
                    Poslano: {kolicinaTekst(s.izdana_kolicina ?? 0, s.izdana_osnovna ?? 0, s)}
                  </span>
                </span>
                {drugacije && (
                  <label className="flex items-center gap-2 text-xl">
                    Stiglo
                    <input
                      name={`primljeno_${s.id}`}
                      defaultValue={String(s.izdana_kolicina ?? 0)}
                      inputMode="decimal"
                      aria-label={`Stiglo ${s.naziv}`}
                      className="min-h-16 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-3xl font-bold bg-white"
                    />
                    <span>{s.pakovanje ?? s.mjera}</span>
                  </label>
                )}
              </li>
            ))}
        </ul>

        {stanje?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {stanje.greska}
          </p>
        )}

        <button
          type="submit"
          disabled={radi}
          className="min-h-28 rounded-2xl bg-green-700 text-5xl font-extrabold tracking-wide text-white active:bg-green-900 disabled:opacity-50"
        >
          {radi ? "Snimam…" : drugacije ? "POTVRDI PRIMLJENO" : "STIGLO"}
        </button>
        <button
          type="button"
          onClick={() => setDrugacije((d) => !d)}
          className="min-h-16 rounded-2xl border-2 border-zinc-400 text-2xl font-semibold text-zinc-700 active:bg-zinc-200"
        >
          {drugacije ? "Ipak je sve stiglo kako je poslano" : "Stiglo je drugačije"}
        </button>
      </form>
    </li>
  );
}
