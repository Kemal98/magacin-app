"use client";

import { useActionState, useId, useState } from "react";
import { unesiPrijem } from "@/app/actions/prijem";
import { km, kolicina as fmtKolicina } from "@/lib/format";

export type ArtikalZaPrijem = {
  id: string;
  naziv: string;
  mjera: string;
  bar_kod: string | null;
  pakovanja: { id: string; naziv: string; faktor: number }[];
};

type Red = { tekst: string; pakovanje: string; kolicina: string; cijena: string };
const PRAZAN: Red = { tekst: "", pakovanje: "", kolicina: "", cijena: "" };
const POLJE = "min-h-14 w-full rounded-xl border-2 border-zinc-300 px-4 text-xl";

const broj = (t: string) => Number(t.trim().replace(",", "."));

export function PrijemForma({
  artikli,
  dobavljaci,
}: {
  artikli: ArtikalZaPrijem[];
  dobavljaci: { id: string; naziv: string }[];
}) {
  const [stanje, akcija, radi] = useActionState(unesiPrijem, undefined);
  const [redovi, setRedovi] = useState<Red[]>([{ ...PRAZAN }]);
  const lista = useId();

  // Artikal se prepoznaje po tačnom nazivu ili bar kodu (i pakovanja).
  const nadji = (tekst: string) => {
    const t = tekst.trim().toLowerCase();
    if (!t) return undefined;
    return (
      artikli.find((a) => a.naziv.toLowerCase() === t) ??
      artikli.find((a) => a.bar_kod === tekst.trim())
    );
  };

  const izmijeni = (i: number, polje: keyof Red, v: string) =>
    setRedovi((stari) =>
      stari.map((r, j) => {
        if (j !== i) return r;
        const novi = { ...r, [polje]: v };
        if (polje === "tekst") novi.pakovanje = ""; // druga vrsta artikla, druga pakovanja
        return novi;
      }),
    );

  return (
    <form action={akcija} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-lg font-semibold">
        Dobavljač
        <select name="dobavljac" defaultValue="" className={POLJE} required>
          <option value="" disabled>
            Izaberite dobavljača
          </option>
          {dobavljaci.map((d) => (
            <option key={d.id} value={d.id}>
              {d.naziv}
            </option>
          ))}
        </select>
      </label>

      <datalist id={lista}>
        {artikli.map((a) => (
          <option key={a.id} value={a.naziv} />
        ))}
      </datalist>

      <div className="flex flex-col gap-4">
        {redovi.map((r, i) => {
          const artikal = nadji(r.tekst);
          const pak = artikal?.pakovanja.find((p) => p.id === r.pakovanje);
          const faktor = pak?.faktor ?? 1;
          const kol = broj(r.kolicina);
          const cij = broj(r.cijena);
          const izracun =
            artikal && kol > 0 && cij >= 0
              ? `= ${fmtKolicina(kol * faktor)} ${artikal.mjera} po ${km(cij / faktor)}/${artikal.mjera}, ukupno ${km(kol * cij)}`
              : null;
          return (
            <fieldset key={i} className="flex flex-col gap-3 rounded-2xl border-2 border-zinc-200 p-4">
              <legend className="px-2 text-lg font-semibold">Stavka {i + 1}</legend>
              <input type="hidden" name="artikal" value={artikal?.id ?? ""} />
              <label className="flex flex-col gap-1 text-lg">
                Artikal (upišite naziv ili izaberite)
                <input
                  list={lista}
                  value={r.tekst}
                  onChange={(e) => izmijeni(i, "tekst", e.target.value)}
                  className={POLJE}
                  autoComplete="off"
                />
              </label>
              {r.tekst.trim() && !artikal && (
                <p className="text-lg text-red-700">Artikal nije pronađen. Izaberite naziv s liste.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-lg">
                  Jedinica
                  <select
                    name="pakovanje"
                    value={r.pakovanje}
                    onChange={(e) => izmijeni(i, "pakovanje", e.target.value)}
                    className={POLJE}
                    disabled={!artikal}
                  >
                    <option value="">{artikal ? artikal.mjera : "—"}</option>
                    {artikal?.pakovanja.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.naziv} ({fmtKolicina(p.faktor)} {artikal.mjera})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-lg">
                  Količina
                  <input
                    name="kolicina"
                    value={r.kolicina}
                    onChange={(e) => izmijeni(i, "kolicina", e.target.value)}
                    inputMode="decimal"
                    className={POLJE}
                  />
                </label>
                <label className="flex flex-col gap-1 text-lg">
                  Cijena po {pak ? pak.naziv : (artikal?.mjera ?? "jedinici")} (KM, bez PDV-a)
                  <input
                    name="cijena"
                    value={r.cijena}
                    onChange={(e) => izmijeni(i, "cijena", e.target.value)}
                    inputMode="decimal"
                    className={POLJE}
                  />
                </label>
              </div>
              {izracun && <p className="text-lg font-semibold text-zinc-700">{izracun}</p>}
              {redovi.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRedovi((stari) => stari.filter((_, j) => j !== i))}
                  className="min-h-12 self-start rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
                >
                  Ukloni stavku
                </button>
              )}
            </fieldset>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRedovi((stari) => [...stari, { ...PRAZAN }])}
        className="min-h-14 self-start rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
      >
        + Dodaj artikal
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
        {radi ? "Snimam…" : "Snimi prijem"}
      </button>
    </form>
  );
}
