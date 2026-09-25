"use client";

import { useActionState, useState } from "react";
import { odbijZahtjev, izdajZahtjev } from "@/app/actions/zahtjevi";
import { KameraSkener } from "@/app/_components/kamera-skener";
import { StatusOznaka, kolicinaTekst } from "@/app/_components/zahtjev-prikaz";
import { pretrazi, type ArtikalZaUnos } from "@/lib/bar-kod";
import { broj } from "@/lib/broj";
import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import { kolikoIma } from "@/lib/zahtjevi-kolicine";
import type { Zahtjev } from "@/lib/zahtjevi-tipovi";

/**
 * Odobren zahtjev spreman za izdavanje. Količina za izdavanje je već prilagođena onome što ima na stanju;
 * za stavku koje nema, magacioner jednim dodirom kaže "nema na stanju" i ona se ne izdaje. Skeniranje bar koda
 * (nije obavezno) potvrđuje da je uzeta prava roba. Ako se ne može izdati ništa, zahtjev se odbija uz razlog.
 */
export function ZahtjevIzdavanje({ z }: { z: Zahtjev }) {
  const [stanje, akcija, radi] = useActionState(izdajZahtjev.bind(null, z.id), undefined);
  const [odbij, akcijaOdbij, odbija] = useActionState(odbijZahtjev.bind(null, z.id), undefined);
  const [odbijanje, setOdbijanje] = useState(false);
  const [provjereno, setProvjereno] = useState<Set<string>>(new Set());
  const [poruka, setPoruka] = useState<string | null>(null);
  const [unos, setUnos] = useState("");
  const [kamera, setKamera] = useState(false);
  // Količina za izdavanje po stavci; početno ono što ima na stanju (najviše koliko je odobreno).
  const [kolicine, setKolicine] = useState<Record<string, string>>(() =>
    Object.fromEntries(z.stavke.map((s) => [s.id, String(kolikoIma(s, s.odobrena_kolicina ?? 0))])),
  );

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

  const izdajeSe = (id: string) => {
    const n = broj(kolicine[id] ?? "");
    return Number.isFinite(n) && n > 0;
  };
  const brojZaIzdavanje = z.stavke.filter((s) => izdajeSe(s.id)).length;
  const prilagodjeno = z.stavke.some((s) => kolikoIma(s, s.odobrena_kolicina ?? 0) < (s.odobrena_kolicina ?? 0));

  return (
    <li data-red className="flex flex-col gap-4 rounded-2xl border border-green-700 bg-white p-4 shadow-sm">
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
            className="min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-semibold active:bg-zinc-200"
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

      {prilagodjeno && (
        <p role="status" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-lg font-semibold text-amber-900">
          Za neke stavke nema dovoljno robe na stanju, pa je količina za izdavanje prilagođena. Ono što se ne izda,
          objekat neće dobiti (može poslati novi zahtjev).
        </p>
      )}

      <form action={akcija} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {z.stavke.map((s) => {
            const gotovo = provjereno.has(s.id);
            const odobrena = s.odobrena_kolicina ?? 0;
            const ima = kolikoIma(s, odobrena);
            const nedovoljno = ima < odobrena;
            const nula = !izdajeSe(s.id);
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border-2 p-3 text-xl ${
                  gotovo ? "border-green-700 bg-green-50" : nedovoljno ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="min-w-56 flex-1">
                  <p className="font-semibold">
                    {gotovo && <span aria-label="provjereno">✓ </span>}
                    {s.naziv}
                  </p>
                  <p className="text-lg text-zinc-600">Odobreno: {kolicinaTekst(odobrena, s.odobrena_osnovna ?? 0, s)}</p>
                  <p className={`text-lg ${nedovoljno ? "font-bold text-red-700" : "text-zinc-600"}`}>
                    Na stanju: {fmt(s.na_stanju ?? 0)} {s.mjera}
                    {nedovoljno && " (nedovoljno)"}
                  </p>
                  {nula && (
                    <p className="text-lg font-bold text-red-800">Ova stavka se neće izdati.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-lg">
                    Izdaj
                    <input
                      name={`izdaj_${s.id}`}
                      value={kolicine[s.id] ?? ""}
                      onChange={(e) => setKolicine((k) => ({ ...k, [s.id]: e.target.value }))}
                      inputMode="decimal"
                      aria-label={`Izdana količina ${s.naziv}`}
                      className="min-h-14 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-2xl font-bold"
                    />
                    <span>{s.pakovanje ?? s.mjera}</span>
                  </label>
                  {!nula && (
                    <button
                      type="button"
                      onClick={() => setKolicine((k) => ({ ...k, [s.id]: "0" }))}
                      aria-label={`Nema na stanju: ne izdaj ${s.naziv}`}
                      className="min-h-14 rounded-xl border-2 border-red-700 bg-white px-4 text-lg font-bold text-red-800 active:bg-red-50"
                    >
                      Nema na stanju
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {provjereno.size > 0 && (
          <p className="text-lg text-zinc-600">
            Provjereno skeniranjem: {provjereno.size} od {z.stavke.length}
          </p>
        )}
        {brojZaIzdavanje === 0 && (
          <p role="alert" className="text-lg font-semibold text-red-700">
            Nijedna stavka se ne izdaje. Ako se ništa ne može izdati, odbijte zahtjev uz razlog.
          </p>
        )}
        {stanje?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {stanje.greska}
          </p>
        )}
        <button
          type="submit"
          disabled={radi || brojZaIzdavanje === 0}
          className="min-h-16 rounded-2xl bg-blue-700 text-2xl font-bold text-white active:bg-blue-900 disabled:opacity-50"
        >
          {radi ? "Izdajem…" : "Označi na dostavi"}
        </button>
      </form>

      {!odbijanje ? (
        <button
          type="button"
          onClick={() => setOdbijanje(true)}
          className="min-h-14 self-start rounded-xl border-2 border-red-700 bg-white px-5 text-lg font-bold text-red-800 active:bg-red-50"
        >
          Ne mogu izdati: odbij zahtjev
        </button>
      ) : (
        <form action={akcijaOdbij} className="flex flex-col gap-3 rounded-xl border-2 border-red-700 p-3">
          <label className="flex flex-col gap-1 text-lg font-semibold">
            Razlog odbijanja (objekat će ga vidjeti)
            <input name="razlog" autoFocus className="min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl font-normal" />
          </label>
          {odbij?.greska && (
            <p role="alert" className="text-lg font-semibold text-red-700">
              {odbij.greska}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={odbija}
              className="min-h-14 rounded-xl bg-red-700 px-6 text-xl font-bold text-white active:bg-red-900 disabled:opacity-50"
            >
              {odbija ? "Odbijam…" : "Potvrdi odbijanje"}
            </button>
            <button
              type="button"
              onClick={() => setOdbijanje(false)}
              className="min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-6 text-xl font-semibold active:bg-zinc-200"
            >
              Odustani
            </button>
          </div>
        </form>
      )}

      {kamera && <KameraSkener onKod={skeniran} onZatvori={() => setKamera(false)} />}
    </li>
  );
}
