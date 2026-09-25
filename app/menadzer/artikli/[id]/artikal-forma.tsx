"use client";

import { useActionState, useState } from "react";
import { sacuvajArtikal } from "@/app/actions/sifrarnik";

export type PakovanjeRed = { id: string | null; naziv: string; faktor: string; bar_kod: string };

export type ArtikalPodaci = {
  id: string;
  naziv: string;
  mjera: "kg" | "l" | "kom";
  bar_kod: string;
  minimum: number;
  vrsta: "prehrana" | "materijal";
  pakovanja: PakovanjeRed[];
};

const POLJE = "min-h-14 w-full rounded-xl border-2 border-zinc-300 px-4 text-xl";

export function ArtikalForma({ artikal }: { artikal?: ArtikalPodaci }) {
  const [stanje, akcija, radi] = useActionState(sacuvajArtikal, undefined);
  const [mjera, setMjera] = useState(artikal?.mjera ?? "kg");
  const [pakovanja, setPakovanja] = useState<PakovanjeRed[]>(artikal?.pakovanja ?? []);

  const izmijeni = (i: number, polje: keyof PakovanjeRed, vrijednost: string) =>
    setPakovanja((stara) => stara.map((p, j) => (j === i ? { ...p, [polje]: vrijednost } : p)));

  return (
    <form action={akcija} className="flex flex-col gap-5">
      {artikal && <input type="hidden" name="id" value={artikal.id} />}

      <label className="flex flex-col gap-1 text-lg font-semibold">
        Naziv
        <input name="naziv" defaultValue={artikal?.naziv} className={POLJE} required />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Osnovna mjera
          <select
            name="mjera"
            value={mjera}
            onChange={(e) => setMjera(e.target.value as typeof mjera)}
            className={POLJE}
          >
            <option value="kg">kg</option>
            <option value="l">l</option>
            <option value="kom">kom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Magacin
          <select name="vrsta" defaultValue={artikal?.vrsta ?? "prehrana"} className={POLJE}>
            <option value="prehrana">Prehrana</option>
            <option value="materijal">Materijal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Bar kod (nije obavezan)
          <input name="bar_kod" defaultValue={artikal?.bar_kod} inputMode="numeric" className={POLJE} />
        </label>
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Minimum zaliha ({mjera})
          <input
            name="minimum"
            defaultValue={artikal?.minimum ?? 0}
            inputMode="decimal"
            className={POLJE}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-4">
        <legend className="px-2 text-xl font-semibold">Pakovanja</legend>
        {pakovanja.length === 0 && (
          <p className="text-lg text-zinc-500">Bez pakovanja: artikal se vodi samo u {mjera}.</p>
        )}
        {pakovanja.map((p, i) => (
          <div key={p.id ?? `novo-${i}`} className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-3">
            <input type="hidden" name="pak_id" value={p.id ?? ""} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-lg">
                Naziv (npr. kutija)
                <input
                  name="pak_naziv"
                  value={p.naziv}
                  onChange={(e) => izmijeni(i, "naziv", e.target.value)}
                  className={POLJE}
                />
              </label>
              <label className="flex flex-col gap-1 text-lg">
                1 {p.naziv || "pakovanje"} = koliko {mjera}
                <input
                  name="pak_faktor"
                  value={p.faktor}
                  onChange={(e) => izmijeni(i, "faktor", e.target.value)}
                  inputMode="decimal"
                  className={POLJE}
                />
              </label>
              <label className="flex flex-col gap-1 text-lg">
                Bar kod pakovanja
                <input
                  name="pak_bar_kod"
                  value={p.bar_kod}
                  onChange={(e) => izmijeni(i, "bar_kod", e.target.value)}
                  inputMode="numeric"
                  className={POLJE}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setPakovanja((stara) => stara.filter((_, j) => j !== i))}
              className="min-h-12 self-start rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
            >
              Ukloni pakovanje
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPakovanja((stara) => [...stara, { id: null, naziv: "", faktor: "", bar_kod: "" }])
          }
          className="min-h-14 self-start rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
        >
          + Dodaj pakovanje
        </button>
      </fieldset>

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
        Snimi artikal
      </button>
    </form>
  );
}
