"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pripremiPregled, potvrdiUvoz } from "@/app/actions/uvoz";
import type { PripremljenUvoz } from "@/lib/uvoz/pripremi";

export function UvozEkran() {
  const [stanje, akcija, radi] = useActionState(pripremiPregled, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={akcija} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 shadow-sm bg-white">
        <p className="text-xl">
          Izaberite Excel fajl sa artiklima, objektima i dobavljačima (<em>Utrošci - zalihe.xlsx</em>). Ulazi i
          utrošci se ne uvoze, a zalihe počinju prazne. Prvo ćete vidjeti pregled; ništa se ne upisuje dok ne
          potvrdite.
        </p>
        <input
          type="file"
          name="fajl"
          accept=".xlsx"
          className="min-h-14 rounded-xl border-2 border-zinc-300 p-3 text-lg bg-white"
        />
        <button
          type="submit"
          disabled={radi}
          className="min-h-16 rounded-2xl bg-brand text-2xl font-semibold text-white active:bg-brand-dark disabled:opacity-50"
        >
          {radi ? "Čitam fajl…" : "Prikaži pregled"}
        </button>
      </form>

      {stanje && "greska" in stanje && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      {stanje && "pregled" in stanje && <Pregled pregled={stanje.pregled} />}
    </div>
  );
}

function Pregled({ pregled }: { pregled: PripremljenUvoz }) {
  const [stanje, akcija, radi] = useActionState(potvrdiUvoz, undefined);

  if (stanje?.uvezeno) {
    const u = stanje.uvezeno;
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-green-700 bg-green-50 p-4 shadow-sm">
        <p className="text-2xl font-bold">Uvoz je završen</p>
        <p className="text-xl">
          Novo: {u.artikli} artikala, {u.objekti} objekata, {u.dobavljaci} dobavljača. Ono što je već postojalo
          nije mijenjano.
        </p>
        <Link href="/menadzer/artikli" className="text-xl font-semibold underline">
          Pogledaj artikle →
        </Link>
      </div>
    );
  }

  return (
    <form action={akcija} className="flex flex-col gap-5">
      <input type="hidden" name="podaci" value={JSON.stringify(pregled)} />

      <section className="rounded-2xl border border-zinc-200 p-4 text-xl shadow-sm bg-white">
        <p className="font-semibold">
          Pročitano: {pregled.artikli.length} artikala, {pregled.objekti.length} objekata,{" "}
          {pregled.dobavljaci.length} dobavljača.
        </p>
        {pregled.napomene.length > 0 && (
          <ul className="mt-2 list-disc pl-6 text-zinc-600">
            {pregled.napomene.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Podjela artikala na prehranu i materijal</h2>
        <p className="text-lg text-zinc-600">
          Ovo je prijedlog po nazivu. Ispravite gdje nije tačno; kasnije se može mijenjati u šifrarniku.
        </p>
        <ul className="flex flex-col gap-2">
          {pregled.artikli.map((a, i) => (
            <li key={a.naziv} className="flex items-center justify-between gap-3 rounded-xl border-2 border-zinc-200 p-3 bg-white">
              <span className="text-lg">
                {a.naziv} <span className="text-zinc-500">({a.mjera})</span>
              </span>
              <select
                name={`vrsta_${i}`}
                defaultValue={a.vrsta}
                aria-label={`Magacin za ${a.naziv}`}
                className="min-h-12 rounded-xl border-2 border-zinc-300 px-3 text-lg bg-white"
              >
                <option value="prehrana">Prehrana</option>
                <option value="materijal">Materijal</option>
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm bg-white">
          <h2 className="text-2xl font-semibold">Objekti</h2>
          <ul className="mt-2 text-lg">{pregled.objekti.map((o) => <li key={o}>{o}</li>)}</ul>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-4 shadow-sm bg-white">
          <h2 className="text-2xl font-semibold">Dobavljači</h2>
          <ul className="mt-2 text-lg">{pregled.dobavljaci.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      </section>

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi}
        className="min-h-16 rounded-2xl bg-green-700 text-2xl font-semibold text-white active:bg-green-900 disabled:opacity-50"
      >
        {radi ? "Uvozim…" : "Potvrdi uvoz"}
      </button>
    </form>
  );
}
