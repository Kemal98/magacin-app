"use client";

import { useActionState, useState } from "react";
import { odbijZahtjev, odobriZahtjev } from "@/app/actions/zahtjevi";
import { StatusOznaka, kolicinaTekst } from "@/app/_components/zahtjev-prikaz";
import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import { kolikoIma } from "@/lib/zahtjevi-kolicine";
import type { Zahtjev } from "@/lib/zahtjevi-tipovi";

/** Zahtjev koji čeka odluku: magacioner odobrava (uz moguće manje količine) ili odbija uz razlog. */
export function ZahtjevObrada({ z }: { z: Zahtjev }) {
  const [odobri, akcijaOdobri, odobrava] = useActionState(odobriZahtjev.bind(null, z.id), undefined);
  const [odbij, akcijaOdbij, odbija] = useActionState(odbijZahtjev.bind(null, z.id), undefined);
  const [odbijanje, setOdbijanje] = useState(false);

  return (
    <li data-red className="flex flex-col gap-4 rounded-2xl border border-amber-500 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold">{z.objekat}</p>
          <p className="text-lg text-zinc-500">
            {z.poslao}, {datumVrijeme(z.vrijeme)}
          </p>
        </div>
        <StatusOznaka status={z.status} />
      </div>

      <form action={akcijaOdobri} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {z.stavke.map((s) => {
            const nedovoljno = s.na_stanju !== null && s.na_stanju < s.trazena_osnovna;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 text-xl">
                <div className="min-w-56 flex-1">
                  <p className="font-semibold">{s.naziv}</p>
                  <p className="text-lg text-zinc-600">Traženo: {kolicinaTekst(s.trazena_kolicina, s.trazena_osnovna, s)}</p>
                  <p className={`text-lg ${nedovoljno ? "font-bold text-red-700" : "text-zinc-600"}`}>
                    Na stanju: {fmt(s.na_stanju ?? 0)} {s.mjera}
                    {nedovoljno && " (nedovoljno)"}
                  </p>
                  {kolikoIma(s, s.trazena_kolicina) === 0 && (
                    <p className="text-lg font-bold text-red-800">Nema robe: po zadanom se ne odobrava (upišite 0 ili količinu koju imate).</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-lg">
                  Odobri
                  <input
                    name={`kolicina_${s.id}`}
                    defaultValue={String(kolikoIma(s, s.trazena_kolicina))}
                    inputMode="decimal"
                    aria-label={`Odobrena količina ${s.naziv}`}
                    className="min-h-14 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-2xl font-bold bg-white"
                  />
                  <span>{s.pakovanje ?? s.mjera}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {odobri?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {odobri.greska}
          </p>
        )}
        {!odbijanje && (
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={odobrava}
              className="min-h-16 flex-1 rounded-2xl bg-green-700 text-2xl font-bold text-white active:bg-green-900 disabled:opacity-50"
            >
              {odobrava ? "Odobravam…" : "Odobri"}
            </button>
            <button
              type="button"
              onClick={() => setOdbijanje(true)}
              className="min-h-16 rounded-2xl border-2 border-red-700 px-8 text-2xl font-bold text-red-800 active:bg-red-50"
            >
              Odbij
            </button>
          </div>
        )}
      </form>

      {odbijanje && (
        <form action={akcijaOdbij} className="flex flex-col gap-3 rounded-2xl border border-red-700 p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xl font-semibold">
            Razlog odbijanja (objekat će ga vidjeti)
            <input name="razlog" autoFocus className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl font-normal bg-white" />
          </label>
          {odbij?.greska && (
            <p role="alert" className="text-xl font-semibold text-red-700">
              {odbij.greska}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={odbija}
              className="min-h-16 rounded-2xl bg-red-700 px-8 text-2xl font-bold text-white active:bg-red-900 disabled:opacity-50"
            >
              {odbija ? "Odbijam…" : "Potvrdi odbijanje"}
            </button>
            <button
              type="button"
              onClick={() => setOdbijanje(false)}
              className="min-h-16 rounded-2xl border-2 border-zinc-300 px-8 text-2xl font-semibold active:bg-zinc-200 bg-white"
            >
              Odustani
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
