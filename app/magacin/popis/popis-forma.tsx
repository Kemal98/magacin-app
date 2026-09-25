"use client";

import { useActionState, useState, useTransition } from "react";
import { pregledajPopis, potvrdiPopis } from "@/app/actions/popis";
import { KameraSkener } from "@/app/_components/kamera-skener";
import { pretrazi, type ArtikalZaUnos } from "@/lib/bar-kod";
import { km, kolicina as fmt } from "@/lib/format";
import type { RedPregleda } from "@/lib/popis-tipovi";

const POLJE = "min-h-14 rounded-xl border-2 border-zinc-300 px-4 text-xl";

/**
 * Popis u dva koraka: 1) brojanje (skenerom ili ručno, sistemsko stanje se ne prikazuje da brojanje
 * ostane nepristrasno), 2) pregled razlika i tek onda potvrda usklađivanja.
 */
export function PopisForma({ artikli }: { artikli: ArtikalZaUnos[] }) {
  const [ucitava, pokreni] = useTransition();
  const [greskaPregleda, setGreskaPregleda] = useState<string | null>(null);
  const [potvrda, akcijaPotvrde, potvrdjuje] = useActionState(potvrdiPopis, undefined);
  const [vrijednosti, setVrijednosti] = useState<Record<string, string>>({});
  const [trazi, setTrazi] = useState("");
  const [skener, setSkener] = useState("");
  const [poruka, setPoruka] = useState<string | null>(null);
  const [samoIzbrojani, setSamoIzbrojani] = useState(false);
  const [pocetno, setPocetno] = useState(false);
  const [kamera, setKamera] = useState(false);
  // Pregled razlika (korak 2); null znači da je otvoreno brojanje (korak 1).
  const [prikazPregleda, setPrikazPregleda] = useState<RedPregleda[] | null>(null);

  const izbrojano = artikli.filter((a) => (vrijednosti[a.id] ?? "").trim() !== "");

  const pregledaj = (forma: FormData) =>
    pokreni(async () => {
      const rezultat = await pregledajPopis(undefined, forma);
      if (rezultat && "redovi" in rezultat) {
        setGreskaPregleda(null);
        setPrikazPregleda(rezultat.redovi);
      } else {
        setGreskaPregleda(rezultat?.greska ?? "Pregled nije uspio. Pokušajte ponovo.");
      }
    });

  const promijeni = (id: string, v: string) => {
    setVrijednosti((s) => ({ ...s, [id]: v }));
  };

  const skeniran = (unos: string): boolean => {
    const r = pretrazi(artikli, unos);
    if (r.status === "nadjen") {
      setTrazi(r.artikal.naziv);
      setPoruka(null);
      setTimeout(() => document.getElementById(`brojano-${r.artikal.id}`)?.focus(), 0);
      return true;
    }
    setPoruka(
      r.status === "nepoznat_kod"
        ? `Bar kod ${r.kod} nije pronađen u šifrarniku.`
        : r.status === "nepoznat_naziv"
          ? `"${r.tekst}" nije pronađen. Izaberite naziv s liste.`
          : null,
    );
    return false;
  };

  const vidljivi = artikli.filter(
    (a) =>
      (!samoIzbrojani || (vrijednosti[a.id] ?? "").trim() !== "") &&
      a.naziv.toLowerCase().includes(trazi.trim().toLowerCase()),
  );

  // Korak 2: pregled razlika
  if (prikazPregleda) {
    const trebaCijenu = prikazPregleda.filter((r) => r.treba_cijenu);
    const ukupno = prikazPregleda.reduce((z, r) => z + r.vrijednost_razlike, 0);
    const razlike = prikazPregleda.filter((r) => r.razlika !== 0).length;
    return (
      <form action={akcijaPotvrde} className="flex flex-col gap-5">
        <h2 className="text-2xl font-semibold">Pregled razlika</h2>
        <p className="text-xl">
          Izbrojano {prikazPregleda.length} artikala, razlika kod {razlike}. Vrijednost razlike:{" "}
          <span className={`font-bold ${ukupno < 0 ? "text-red-700" : ukupno > 0 ? "text-green-800" : ""}`}>{km(ukupno)}</span>
        </p>
        <p className="text-lg text-zinc-600">Ništa još nije upisano. Provjerite razlike, pa potvrdite ili se vratite na brojanje.</p>

        <table className="w-full text-left text-lg">
          <thead>
            <tr className="border-b-2 border-zinc-300">
              <th className="py-1">Artikal</th>
              <th className="py-1 text-right">Sistem</th>
              <th className="py-1 text-right">Brojano</th>
              <th className="py-1 text-right">Razlika</th>
              <th className="py-1 text-right">Vrijednost</th>
            </tr>
          </thead>
          <tbody>
            {prikazPregleda.map((r) => (
              <tr key={r.artikal_id} className={`border-b border-zinc-200 align-top ${r.razlika === 0 ? "text-zinc-500" : ""}`}>
                <td className="py-2">
                  {r.naziv}
                  {r.treba_cijenu && (
                    <label className="mt-1 flex items-center gap-2 text-base font-semibold text-amber-900">
                      Cijena po {r.mjera} (KM):
                      <input
                        name={`cijena_${r.artikal_id}`}
                        required
                        inputMode="decimal"
                        aria-label={`Cijena za ${r.naziv}`}
                        className="min-h-12 w-28 rounded-xl border-2 border-amber-600 px-3 text-lg font-normal"
                      />
                    </label>
                  )}
                  <input type="hidden" name={`brojano_${r.artikal_id}`} value={r.brojano} />
                  <input type="hidden" name={`sistem_${r.artikal_id}`} value={r.sistem} />
                </td>
                <td className="py-2 text-right">{fmt(r.sistem)}</td>
                <td className="py-2 text-right">{fmt(r.brojano)}</td>
                <td className={`py-2 text-right font-bold ${r.razlika < 0 ? "text-red-700" : r.razlika > 0 ? "text-green-800" : ""}`}>
                  {r.razlika > 0 ? "+" : ""}
                  {fmt(r.razlika)} {r.mjera}
                </td>
                <td className="py-2 text-right">{r.treba_cijenu ? "—" : km(r.vrijednost_razlike)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {trebaCijenu.length > 0 && (
          <p className="text-lg font-semibold text-amber-900">
            Za {trebaCijenu.length} artikala nema poznate cijene: upišite nabavnu cijenu (KM bez PDV-a).
          </p>
        )}
        <label className="flex min-h-14 items-center gap-3 text-xl">
          <input
            type="checkbox"
            name="pocetno"
            checked={pocetno}
            onChange={(e) => setPocetno(e.target.checked)}
            className="size-7"
          />
          Ovo je početno stanje (prvi popis na dan početka rada)
        </label>

        {potvrda?.greska && (
          <p role="alert" className="text-xl font-semibold text-red-700">
            {potvrda.greska}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={potvrdjuje}
            className="min-h-16 flex-1 rounded-2xl bg-brand text-2xl font-bold text-white shadow-sm active:bg-brand-dark disabled:opacity-50"
          >
            {potvrdjuje ? "Potvrđujem…" : "Potvrdi popis i uskladi stanje"}
          </button>
          <button
            type="button"
            onClick={() => setPrikazPregleda(null) /* natrag na brojanje, unesene količine ostaju */}
            className="min-h-16 rounded-2xl border-2 border-zinc-300 bg-white px-8 text-2xl font-semibold text-zinc-700 active:bg-zinc-200"
          >
            Nazad na brojanje
          </button>
        </div>
      </form>
    );
  }

  // Korak 1: brojanje
  return (
    <form action={pregledaj} className="flex flex-col gap-5">
      <p className="text-xl text-zinc-600">
        Skenirajte ili izaberite artikal i upišite izbrojanu količinu. Artikli koje ne upišete ostaju kako jesu.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <input
            value={skener}
            onChange={(e) => setSkener(e.target.value)}
            onKeyDown={(e) => {
              // Skener šalje Enter na kraju koda; on ne smije poslati formu.
              if (e.key === "Enter") {
                e.preventDefault();
                if (skeniran(e.currentTarget.value)) setSkener("");
              }
            }}
            placeholder="Skenirajte bar kod artikla"
            aria-label="Skenirajte bar kod"
            autoComplete="off"
            className={`${POLJE} flex-1`}
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

      <div className="flex flex-wrap items-center gap-4">
        <input
          value={trazi}
          onChange={(e) => setTrazi(e.target.value)}
          placeholder="Traži artikal"
          aria-label="Traži artikal"
          className={`${POLJE} flex-1`}
        />
        <label className="flex min-h-14 items-center gap-3 text-lg">
          <input type="checkbox" checked={samoIzbrojani} onChange={(e) => setSamoIzbrojani(e.target.checked)} className="size-6" />
          Samo izbrojani
        </label>
      </div>

      <p className="text-xl font-bold">Izbrojano artikala: {izbrojano.length}</p>

      <ul className="flex flex-col gap-2">
        {vidljivi.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <span className="min-w-56 flex-1 text-xl font-semibold">{a.naziv}</span>
            <label className="flex items-center gap-2 text-lg">
              Izbrojano
              <input
                id={`brojano-${a.id}`}
                name={`brojano_${a.id}`}
                value={vrijednosti[a.id] ?? ""}
                onChange={(e) => promijeni(a.id, e.target.value)}
                inputMode="decimal"
                aria-label={`Izbrojano ${a.naziv}`}
                className="min-h-14 w-28 rounded-xl border-2 border-zinc-300 px-3 text-center text-2xl font-bold"
              />
              <span className="w-8 text-zinc-500">{a.mjera}</span>
            </label>
          </li>
        ))}
        {vidljivi.length === 0 && <li className="text-xl text-zinc-500">Nema artikala za prikaz.</li>}
      </ul>

      {greskaPregleda && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {greskaPregleda}
        </p>
      )}
      <button
        type="submit"
        disabled={ucitava || izbrojano.length === 0}
        className="min-h-16 rounded-2xl bg-brand text-2xl font-bold text-white shadow-sm active:bg-brand-dark disabled:opacity-50"
      >
        {ucitava ? "Računam…" : "Pregled razlika"}
      </button>

      {kamera && <KameraSkener onKod={(kod) => skeniran(kod)} onZatvori={() => setKamera(false)} />}
    </form>
  );
}
