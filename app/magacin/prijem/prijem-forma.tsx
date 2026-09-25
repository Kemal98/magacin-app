"use client";

import { useActionState, useId, useState } from "react";
import { unesiPrijem } from "@/app/actions/prijem";
import { KameraSkener } from "@/app/_components/kamera-skener";
import { pretrazi, type ArtikalZaUnos } from "@/lib/bar-kod";
import { km, kolicina as fmtKolicina } from "@/lib/format";

type Red = {
  tekst: string; // ono što piše u polju (naziv ili kod koji se skenira)
  artikalId: string;
  pakovanje: string;
  kolicina: string;
  cijena: string;
  poruka: string | null;
  fokus: boolean; // novi red preuzima fokus, da se odmah može skenirati
};

const noviRed = (fokus = false): Red => ({
  tekst: "",
  artikalId: "",
  pakovanje: "",
  kolicina: "",
  cijena: "",
  poruka: null,
  fokus,
});
const POLJE = "min-h-14 w-full rounded-xl border-2 border-zinc-300 px-4 text-xl";

const broj = (t: string) => Number(t.trim().replace(",", "."));

export function PrijemForma({
  artikli,
  dobavljaci,
}: {
  artikli: ArtikalZaUnos[];
  dobavljaci: { id: string; naziv: string }[];
}) {
  const [stanje, akcija, radi] = useActionState(unesiPrijem, undefined);
  const [redovi, setRedovi] = useState<Red[]>([noviRed()]);
  const [kameraZaRed, setKameraZaRed] = useState<number | null>(null);
  const lista = useId();

  const izmijeniRed = (i: number, promjena: Partial<Red>) =>
    setRedovi((stari) => stari.map((r, j) => (j === i ? { ...r, ...promjena } : r)));

  /** Kucanje: tačan naziv se prepoznaje odmah; bar kod se prepoznaje tek na Enter ili napuštanje polja. */
  const napisano = (i: number, tekst: string) => {
    const nadjen = artikli.find((a) => a.naziv.trim().toLowerCase() === tekst.trim().toLowerCase());
    izmijeniRed(i, { tekst, artikalId: nadjen?.id ?? "", pakovanje: "", poruka: null });
  };

  /** Skener, kamera ili ručni unos su gotovi: pronađi artikal i popuni red. */
  const razrijesi = (i: number, unos: string): boolean => {
    const r = pretrazi(artikli, unos);
    if (r.status === "nadjen") {
      izmijeniRed(i, {
        tekst: r.artikal.naziv,
        artikalId: r.artikal.id,
        pakovanje: r.pakovanjeId ?? "",
        poruka: null,
      });
      return true;
    }
    izmijeniRed(i, {
      artikalId: "",
      pakovanje: "",
      poruka:
        r.status === "nepoznat_kod"
          ? `Bar kod ${r.kod} nije pronađen u šifrarniku. Izaberite artikal s liste ili ga dodaje menadžer.`
          : r.status === "nepoznat_naziv"
            ? "Artikal nije pronađen. Izaberite naziv s liste."
            : null,
    });
    return false;
  };

  const fokusirajKolicinu = (i: number) =>
    // Čeka da se red ponovo iscrta s popunjenim artiklom.
    setTimeout(() => document.getElementById(`kolicina-${i}`)?.focus(), 0);

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
          const artikal = artikli.find((a) => a.id === r.artikalId);
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
              <input type="hidden" name="artikal" value={r.artikalId} />
              <div className="flex flex-col gap-1 text-lg">
                <label htmlFor={`artikal-${i}`}>Artikal: skenirajte bar kod, upišite naziv ili izaberite s liste</label>
                <div className="flex gap-3">
                  <input
                    id={`artikal-${i}`}
                    list={lista}
                    value={r.tekst}
                    autoFocus={r.fokus}
                    onChange={(e) => napisano(i, e.target.value)}
                    onKeyDown={(e) => {
                      // Skener na kraju šalje Enter; on ne smije poslati cijelu formu.
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (razrijesi(i, e.currentTarget.value)) fokusirajKolicinu(i);
                      }
                    }}
                    onBlur={(e) => {
                      if (!r.artikalId && e.currentTarget.value.trim()) razrijesi(i, e.currentTarget.value);
                    }}
                    className={POLJE}
                    autoComplete="off"
                    inputMode="text"
                  />
                  <button
                    type="button"
                    onClick={() => setKameraZaRed(i)}
                    className="min-h-14 shrink-0 rounded-xl border-2 border-zinc-300 px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
                  >
                    Kamera
                  </button>
                </div>
              </div>
              {r.poruka && (
                <p role="alert" className="text-lg font-semibold text-red-700">
                  {r.poruka}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-lg">
                  Jedinica
                  <select
                    name="pakovanje"
                    value={r.pakovanje}
                    onChange={(e) => izmijeniRed(i, { pakovanje: e.target.value })}
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
                    id={`kolicina-${i}`}
                    name="kolicina"
                    value={r.kolicina}
                    onChange={(e) => izmijeniRed(i, { kolicina: e.target.value })}
                    inputMode="decimal"
                    className={POLJE}
                  />
                </label>
                <label className="flex flex-col gap-1 text-lg">
                  Cijena po {pak ? pak.naziv : (artikal?.mjera ?? "jedinici")} (KM, bez PDV-a)
                  <input
                    name="cijena"
                    value={r.cijena}
                    onChange={(e) => izmijeniRed(i, { cijena: e.target.value })}
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
        onClick={() => setRedovi((stari) => [...stari, noviRed(true)])}
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

      {kameraZaRed !== null && (
        <KameraSkener
          onKod={(kod) => {
            if (razrijesi(kameraZaRed, kod)) fokusirajKolicinu(kameraZaRed);
          }}
          onZatvori={() => setKameraZaRed(null)}
        />
      )}
    </form>
  );
}
