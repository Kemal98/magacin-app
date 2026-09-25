"use client";

import { useActionState, useState } from "react";
import { posaljiZahtjev } from "@/app/actions/zahtjevi";
import type { ArtikalZaUnos } from "@/lib/bar-kod";
import { kolicina as fmt } from "@/lib/format";

type Stavka = { pakovanje: string; kolicina: string };

const broj = (t: string) => Number(t.trim().replace(",", "."));
const DUGME = "min-h-16 min-w-16 rounded-2xl border-2 border-zinc-400 text-3xl font-bold active:bg-zinc-200";

/** Zahtjev za robu za tablet: veliki artikli za dodir, količina dugmadima + i −. */
export function ZahtjevForma({ artikli }: { artikli: ArtikalZaUnos[] }) {
  const [stanje, akcija, radi] = useActionState(posaljiZahtjev, undefined);
  const [trazi, setTrazi] = useState("");
  // Redoslijed dodavanja se čuva (Map pamti redoslijed umetanja).
  const [korpa, setKorpa] = useState<Map<string, Stavka>>(new Map());

  const dodaj = (id: string) =>
    setKorpa((stara) => {
      if (stara.has(id)) return stara;
      return new Map(stara).set(id, { pakovanje: "", kolicina: "1" });
    });
  const izmijeni = (id: string, promjena: Partial<Stavka>) =>
    setKorpa((stara) => new Map(stara).set(id, { ...stara.get(id)!, ...promjena }));
  const ukloni = (id: string) =>
    setKorpa((stara) => {
      const nova = new Map(stara);
      nova.delete(id);
      return nova;
    });
  const korak = (id: string, razlika: number) => {
    const trenutna = broj(korpa.get(id)!.kolicina);
    const nova = Math.max(0, (Number.isFinite(trenutna) ? trenutna : 0) + razlika);
    izmijeni(id, { kolicina: String(nova) });
  };

  const vidljivi = artikli.filter((a) => a.naziv.toLowerCase().includes(trazi.trim().toLowerCase()));

  return (
    <form action={akcija} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Izaberite artikle</h2>
        <input
          value={trazi}
          onChange={(e) => setTrazi(e.target.value)}
          placeholder="Traži artikal"
          aria-label="Traži artikal"
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-2xl bg-white"
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {vidljivi.map((a) => {
            const uKorpi = korpa.has(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => dodaj(a.id)}
                  aria-pressed={uKorpi}
                  className={`flex min-h-24 w-full flex-col items-start justify-center gap-1 rounded-2xl border-2 p-3 text-left text-xl font-semibold active:bg-zinc-200 ${
                    uKorpi ? "border-green-700 bg-green-50" : "border-zinc-200 bg-white shadow-sm"
                  }`}
                >
                  <span>{a.naziv}</span>
                  <span className="text-lg font-normal text-zinc-500">{uKorpi ? "✓ dodano" : a.mjera}</span>
                </button>
              </li>
            );
          })}
          {vidljivi.length === 0 && <li className="text-xl text-zinc-500">Nema artikala za prikaz.</li>}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Vaš zahtjev ({korpa.size})</h2>
        {korpa.size === 0 && <p className="text-xl text-zinc-500">Dodirnite artikal iznad da ga dodate.</p>}
        {[...korpa].map(([id, s]) => {
          const a = artikli.find((x) => x.id === id)!;
          return (
            <div key={id} className="flex flex-col gap-3 rounded-2xl border border-zinc-300 p-4 shadow-sm bg-white">
              <input type="hidden" name="artikal" value={id} />
              <input type="hidden" name="pakovanje" value={s.pakovanje} />
              <p className="text-2xl font-bold">{a.naziv}</p>

              {a.pakovanja.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Jedinica za ${a.naziv}`}>
                  {[{ id: "", naziv: a.mjera, faktor: 1 }, ...a.pakovanja].map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => izmijeni(id, { pakovanje: j.id })}
                      aria-pressed={s.pakovanje === j.id}
                      className={`min-h-14 rounded-xl border-2 px-5 text-xl font-semibold ${
                        s.pakovanje === j.id ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white"
                      }`}
                    >
                      {j.naziv}
                      {j.id && ` (${fmt(j.faktor)} ${a.mjera})`}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => korak(id, -1)} className={DUGME} aria-label={`Manje ${a.naziv}`}>
                  −
                </button>
                <input
                  name="kolicina"
                  value={s.kolicina}
                  onChange={(e) => izmijeni(id, { kolicina: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Količina ${a.naziv}`}
                  className="min-h-16 w-28 rounded-2xl border-2 border-zinc-300 text-center text-3xl font-bold bg-white"
                />
                <button type="button" onClick={() => korak(id, 1)} className={DUGME} aria-label={`Više ${a.naziv}`}>
                  +
                </button>
                <span className="text-2xl text-zinc-600">
                  {s.pakovanje ? a.pakovanja.find((p) => p.id === s.pakovanje)?.naziv : a.mjera}
                </span>
                <button
                  type="button"
                  onClick={() => ukloni(id)}
                  className="ml-auto min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200 bg-white"
                >
                  Ukloni
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi || korpa.size === 0}
        className="min-h-20 rounded-2xl bg-green-700 text-3xl font-bold text-white active:bg-green-900 disabled:opacity-50"
      >
        {radi ? "Šaljem…" : "Pošalji zahtjev"}
      </button>
    </form>
  );
}
