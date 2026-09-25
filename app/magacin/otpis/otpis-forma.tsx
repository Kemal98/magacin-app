"use client";

import { useActionState, useId, useState } from "react";
import { otpisiRobu } from "@/app/actions/otpis";
import { KameraSkener } from "@/app/_components/kamera-skener";
import { broj } from "@/lib/broj";
import { pretrazi, type ArtikalZaUnos } from "@/lib/bar-kod";
import { kolicina as fmt } from "@/lib/format";

type Artikal = ArtikalZaUnos & { naStanju: number };

const RAZLOZI = ["Isteklo rok trajanja", "Pokvareno", "Polomljeno / oštećeno"];
const POLJE = "min-h-14 w-full rounded-xl border-2 border-zinc-300 px-4 text-xl";

/** Otpis robe iz magacina: artikal (skener, naziv ili lista), količina, razlog. */
export function OtpisForma({ artikli }: { artikli: Artikal[] }) {
  const [stanje, akcija, radi] = useActionState(otpisiRobu, undefined);
  const [tekst, setTekst] = useState("");
  const [artikalId, setArtikalId] = useState("");
  const [pakovanje, setPakovanje] = useState("");
  const [kolicina, setKolicina] = useState("");
  const [razlog, setRazlog] = useState("");
  const [poruka, setPoruka] = useState<string | null>(null);
  const [kamera, setKamera] = useState(false);
  const lista = useId();

  const artikal = artikli.find((a) => a.id === artikalId);
  const pak = artikal?.pakovanja.find((p) => p.id === pakovanje);
  const kol = broj(kolicina);
  const osnovna = kol > 0 ? kol * (pak?.faktor ?? 1) : 0;
  const previse = artikal !== undefined && osnovna > artikal.naStanju + 1e-9;

  const napisano = (t: string) => {
    setTekst(t);
    setPoruka(null);
    const nadjen = artikli.find((a) => a.naziv.trim().toLowerCase() === t.trim().toLowerCase());
    setArtikalId(nadjen?.id ?? "");
    setPakovanje("");
  };

  const razrijesi = (unos: string): boolean => {
    const r = pretrazi(artikli, unos);
    if (r.status === "nadjen") {
      setTekst(r.artikal.naziv);
      setArtikalId(r.artikal.id);
      setPakovanje(r.pakovanjeId ?? "");
      setPoruka(null);
      return true;
    }
    setArtikalId("");
    setPakovanje("");
    setPoruka(
      r.status === "nepoznat_kod"
        ? `Bar kod ${r.kod} nije pronađen u šifrarniku.`
        : r.status === "nepoznat_naziv"
          ? "Artikal nije pronađen. Izaberite naziv s liste."
          : null,
    );
    return false;
  };

  return (
    <form action={akcija} className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="artikal" value={artikalId} />

      <div className="flex flex-col gap-1 text-lg">
        <label htmlFor="otpis-artikal" className="font-semibold">
          Artikal: skenirajte bar kod, upišite naziv ili izaberite s liste
        </label>
        <div className="flex gap-3">
          <input
            id="otpis-artikal"
            list={lista}
            value={tekst}
            onChange={(e) => napisano(e.target.value)}
            onKeyDown={(e) => {
              // Skener šalje Enter na kraju koda; on ne smije poslati formu.
              if (e.key === "Enter") {
                e.preventDefault();
                razrijesi(e.currentTarget.value);
              }
            }}
            onBlur={(e) => {
              if (!artikalId && e.currentTarget.value.trim()) razrijesi(e.currentTarget.value);
            }}
            autoComplete="off"
            className={POLJE}
          />
          <button
            type="button"
            onClick={() => setKamera(true)}
            className="min-h-14 shrink-0 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
          >
            Kamera
          </button>
        </div>
        <datalist id={lista}>
          {artikli.map((a) => (
            <option key={a.id} value={a.naziv} />
          ))}
        </datalist>
        {poruka && (
          <p role="alert" className="font-semibold text-red-700">
            {poruka}
          </p>
        )}
        {artikal && (
          <p className="text-zinc-600">
            Na stanju: <span className="font-bold">{fmt(artikal.naStanju)} {artikal.mjera}</span>
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-lg">
          Jedinica
          <select
            name="pakovanje"
            value={pakovanje}
            onChange={(e) => setPakovanje(e.target.value)}
            disabled={!artikal}
            className={POLJE}
          >
            <option value="">{artikal ? artikal.mjera : "—"}</option>
            {artikal?.pakovanja.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naziv} ({fmt(p.faktor)} {artikal.mjera})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-lg">
          Količina
          <input
            name="kolicina"
            value={kolicina}
            onChange={(e) => setKolicina(e.target.value)}
            inputMode="decimal"
            className={POLJE}
          />
        </label>
      </div>
      {previse && (
        <p role="alert" className="text-lg font-semibold text-red-700">
          Na stanju je samo {fmt(artikal!.naStanju)} {artikal!.mjera}, a otpisujete {fmt(osnovna)} {artikal!.mjera}.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="otpis-razlog" className="text-lg font-semibold">
          Razlog (obavezno)
        </label>
        <div className="flex flex-wrap gap-2">
          {RAZLOZI.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRazlog(r)}
              className="min-h-12 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-semibold active:bg-zinc-200"
            >
              {r}
            </button>
          ))}
        </div>
        <input id="otpis-razlog" name="razlog" value={razlog} onChange={(e) => setRazlog(e.target.value)} className={POLJE} />
      </div>

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi || !artikalId || previse}
        className="min-h-16 rounded-2xl bg-red-700 text-2xl font-semibold text-white active:bg-red-900 disabled:opacity-50"
      >
        {radi ? "Snimam…" : "Otpiši robu"}
      </button>

      {kamera && (
        <KameraSkener
          onKod={(kod) => {
            razrijesi(kod);
          }}
          onZatvori={() => setKamera(false)}
        />
      )}
    </form>
  );
}
