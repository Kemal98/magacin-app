"use client";

import { useActionState } from "react";
import { sacuvajNaziv } from "@/app/actions/sifrarnik";

/** Dodavanje (bez id) ili preimenovanje objekta ili dobavljača. */
export function NazivForma({
  vrsta,
  id,
  naziv = "",
  dugme,
}: {
  vrsta: "objekat" | "dobavljac";
  id?: string;
  naziv?: string;
  dugme: string;
}) {
  const [stanje, akcija, radi] = useActionState(sacuvajNaziv.bind(null, vrsta), undefined);
  return (
    <form action={akcija} className="flex flex-1 flex-col gap-2">
      <div className="flex gap-3">
        {id && <input type="hidden" name="id" value={id} />}
        <input
          name="naziv"
          defaultValue={naziv}
          key={naziv}
          aria-label="Naziv"
          className="min-h-14 flex-1 rounded-xl border-2 border-zinc-300 px-4 text-xl"
        />
        <button
          type="submit"
          disabled={radi}
          className="min-h-14 rounded-xl bg-zinc-900 px-6 text-lg font-semibold text-white active:bg-zinc-700 disabled:opacity-50"
        >
          {dugme}
        </button>
      </div>
      {stanje?.greska && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
    </form>
  );
}
