"use client";

import { useActionState, useState } from "react";
import { izdajZahtjev } from "@/app/actions/zahtjevi";
import { KameraSkener } from "@/app/_components/kamera-skener";
import { StatusOznaka, kolicinaTekst } from "@/app/_components/zahtjev-prikaz";
import { pretrazi, type ArtikalZaUnos } from "@/lib/bar-kod";
import { datumVrijeme } from "@/lib/format";
import type { Zahtjev } from "@/lib/zahtjevi-tipovi";

/**
 * Odobren zahtjev spreman za izdavanje. Skeniranjem bar koda magacioner potvrđuje da je uzeo
 * pravu robu (nije obavezno), pa označava zahtjev "na dostavi" i roba se skida sa zalihe.
 */
export function ZahtjevIzdavanje({ z }: { z: Zahtjev }) {
  const [stanje, akcija, radi] = useActionState(izdajZahtjev.bind(null, z.id), undefined);
  const [provjereno, setProvjereno] = useState<Set<string>>(new Set());
  const [poruka, setPoruka] = useState<string | null>(null);
  const [unos, setUnos] = useState("");
  const [kamera, setKamera] = useState(false);

  // Stavke zahtjeva u obliku koji zna pretraga (skener, naziv, bar kod pakovanja).
  const artikli: ArtikalZaUnos[] = z.stavke.map((s) => ({
    id: s.id,
    naziv: s.naziv,
    mjera: s.mjera,
    bar_kod: s.bar_kod,
    pakovanja: s.pakovanje ? [{ id: `${s.id}-pak`, naziv: s.pakovanje, faktor: s.faktor ?? 1, bar_kod: s.pakovanje_bar_kod }] : [],
  }));

  const skeniran = (tekst: string) => {
    const r = pretrazi(artikli, tekst);
    if (r.status === "nadjen") {
      setProvjereno((stari) => new Set(stari).add(r.artikal.id));
      setPoruka(null);
    } else if (r.status === "nepoznat_kod") {
      setPoruka(`Bar kod ${r.kod} ne odgovara nijednoj stavci ovog zahtjeva.`);
    } else if (r.status === "nepoznat_naziv") {
      setPoruka(`"${r.tekst}" nije na ovom zahtjevu.`);
    }
    setUnos("");
  };

  return (
    <li className="flex flex-col gap-4 rounded-2xl border-2 border-green-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold">{z.objekat}</p>
          <p className="text-lg text-zinc-500">
            Traži: {z.poslao}, {datumVrijeme(z.vrijeme)} · odobrio: {z.odobrio}
          </p>
        </div>
        <StatusOznaka status={z.status} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <input
            value={unos}
            onChange={(e) => setUnos(e.target.value)}
            onKeyDown={(e) => {
              // Skener šalje Enter na kraju koda; on ne smije poslati formu.
              if (e.key === "Enter") {
                e.preventDefault();
                skeniran(e.currentTarget.value);
              }
            }}
            placeholder="Skenirajte artikal (nije obavezno)"
            aria-label="Skenirajte artikal"
            autoComplete="off"
            className="min-h-14 flex-1 rounded-xl border-2 border-zinc-300 px-4 text-xl"
          />
          <button
            type="button"
            onClick={() => setKamera(true)}
            className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold active:bg-zinc-200"
          >
            Kamera
          </button>
        </div>
        {poruka && (
          <p role="alert" className="text-lg font-semibold text-red-700">
            {poruka}
          </p>
        )}
      </div>

      <form action={akcija} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {z.stavke.map((s) => {
            const gotovo = provjereno.has(s.id);
            const odobrena = s.odobrena_kolicina ?? 0;
            const nedovoljno = s.na_stanju !== null && s.na_stanju < (s.odobrena_osnovna ?? 0);
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-3 text-xl ${gotovo ? "border-green-700 bg-green-50" : "border-zinc-200"}`}
              >
                <div className="min-w-56 flex-1">
                  <p className="font-semibold">
                    {gotovo && <span aria-label="provjereno">✓ </span>}
                    {s.naziv}
                  </p>
                  <p className="text-lg text-zinc-600">
                    Odobreno: {kolicinaTekst(odobrena, s.odobrena_osnovna ?? 0, s)}
                  </p>
                  <p className={`text-lg ${nedovoljno ? "font-bold text-red-700" : "text-zinc-600"}`}>
                    Na stanju: {s.na_stanju ?? 0} {s.mjera}
                    {nedovoljno && " (nedovoljno)"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-lg">
                  Izdaj
                  <input
                    name={`izdaj_${s.id}`}
                    defaultValue={String(odobrena)}
                    inputMode="decimal"
                    aria-label={`Izdana količina ${s.naziv}`}
                    className="min-h-14 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-2xl font-bold"
                  />
                  <span>{s.pakovanje ?? s.mjera}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {provjereno.size > 0 && (
          <p className="text-lg text-zinc-600">
            Provjereno skeniranjem: {provjereno.size} od {z.stavke.length}
          </p>
        )}
        {stanje?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {stanje.greska}
          </p>
        )}
        <button
          type="submit"
          disabled={radi}
          className="min-h-16 rounded-2xl bg-blue-700 text-2xl font-bold text-white active:bg-blue-900 disabled:opacity-50"
        >
          {radi ? "Izdajem…" : "Označi na dostavi"}
        </button>
      </form>

      {kamera && (
        <KameraSkener
          onKod={skeniran}
          onZatvori={() => setKamera(false)}
        />
      )}
    </li>
  );
}
