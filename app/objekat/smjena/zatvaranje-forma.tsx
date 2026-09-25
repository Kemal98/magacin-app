"use client";

import { useActionState, useRef, useState } from "react";
import { zatvoriSmjenu } from "@/app/actions/smjene";
import { broj } from "@/lib/broj";
import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import type { RedZaZatvaranje } from "@/lib/smjene-tipovi";

const POLJE = "min-h-16 w-32 rounded-xl border-2 border-zinc-300 px-3 text-center text-3xl font-bold";

/**
 * Završno stanje na kraju smjene. Svaki artikal koji je po sistemu na zalihi mora biti izbrojan.
 * Ako je upisano više nego što je moguće, traži se razlog (ne blokira zatvaranje).
 */
export type ZadnjaSmjena = { zatvorena: string; ime: string; naziv: string | null };

export function ZatvaranjeForma({ redovi, zadnja = null }: { redovi: RedZaZatvaranje[]; zadnja?: ZadnjaSmjena | null }) {
  const [stanje, akcija, radi] = useActionState(zatvoriSmjenu, undefined);
  const [vrijednosti, setVrijednosti] = useState<Record<string, string>>({});
  const forma = useRef<HTMLFormElement>(null);
  const [potvrda, setPotvrda] = useState(false);
  // Od zadnjeg zatvaranja nije stiglo ništa novo ni zabilježen izuzetak: vjerovatno je smjena već zatvorena.
  const nemaPromjena = redovi.every((r) => r.primljeno === 0 && r.izuzeci === 0);

  const naZalihi = redovi.filter((r) => r.moguce > 0);
  const ostali = redovi.filter((r) => r.moguce <= 0);
  const nedostaje = naZalihi.filter((r) => (vrijednosti[r.artikal_id] ?? "").trim() === "").length;

  const red = (r: RedZaZatvaranje, obavezno: boolean) => {
    const upisano = vrijednosti[r.artikal_id] ?? "";
    const n = broj(upisano);
    const visak = Number.isFinite(n) && n > r.moguce + 1e-9;
    return (
      <li key={r.artikal_id} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-3 shadow-sm bg-white">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <p className="text-2xl font-semibold">{r.naziv}</p>
            <p className="text-lg text-zinc-600">
              Početno {fmt(r.pocetno)} + primljeno {fmt(r.primljeno)}
              {r.izuzeci > 0 && ` − izuzeci ${fmt(r.izuzeci)}`} ({r.mjera})
            </p>
          </div>
          <label className="flex items-center gap-2 text-xl">
            Izbrojano
            <input
              name={`zavrsno_${r.artikal_id}`}
              value={upisano}
              onChange={(e) => setVrijednosti((v) => ({ ...v, [r.artikal_id]: e.target.value }))}
              inputMode="decimal"
              aria-label={`Završno stanje ${r.naziv}`}
              required={obavezno}
              className={POLJE}
            />
            <span>{r.mjera}</span>
          </label>
        </div>
        {visak && (
          <label className="flex flex-col gap-1 text-lg font-semibold text-amber-900">
            Upisali ste više nego što bi trebalo biti. Razlog (npr. dobijeno od kuhinje):
            <input
              name={`razlog_${r.artikal_id}`}
              required
              aria-label={`Razlog za ${r.naziv}`}
              className="min-h-14 rounded-xl border-2 border-amber-600 px-4 text-xl font-normal"
            />
          </label>
        )}
      </li>
    );
  };

  return (
    <form ref={forma} action={akcija} className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-2xl font-semibold">Šta znači zatvaranje smjene?</h2>
        <p className="text-lg text-zinc-700">
          Izbrojite robu na kraju smjene i upišite koliko ste našli. Aplikacija iz toga izračuna šta je potrošeno i to
          knjiži kao trošak objekta. Ono što ste izbrojali postaje <strong>početno stanje sljedeće smjene</strong>, koja
          počinje odmah. Zato se ova stranica uvijek može otvoriti ponovo: to ne vraća zatvorenu smjenu, nego bi
          zatvorilo novu.
        </p>
        {zadnja ? (
          <p className="text-lg font-semibold text-brand">
            Zadnja smjena je zatvorena {datumVrijeme(zadnja.zatvorena)}
            {zadnja.naziv && ` (${zadnja.naziv})`}, zatvorio: {zadnja.ime}. Sve što sada upišete ide u novu smjenu.
          </p>
        ) : (
          <p className="text-lg text-zinc-600">Ovo bi bila prva zatvorena smjena ovog objekta.</p>
        )}
        {zadnja && nemaPromjena && (
          <p role="alert" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-lg font-semibold text-amber-900">
            Od zadnjeg zatvaranja nije stigla nova roba ni zabilježen izuzetak. Provjerite da smjenu niste već zatvorili.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Artikli na zalihi ({naZalihi.length})</h2>
        {naZalihi.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema artikala na zalihi objekta.</p>
        ) : (
          <ul className="flex flex-col gap-3">{naZalihi.map((r) => red(r, true))}</ul>
        )}
      </section>

      {ostali.length > 0 && (
        <details className="rounded-2xl border border-zinc-200 p-3 shadow-sm bg-white">
          <summary className="min-h-14 cursor-pointer text-xl font-semibold">
            Ostali artikli s popisa ({ostali.length}): upišite samo ako ste nešto našli
          </summary>
          <ul className="mt-3 flex flex-col gap-3">{ostali.map((r) => red(r, false))}</ul>
        </details>
      )}

      <label className="flex flex-col gap-1 text-2xl font-semibold">
        Ime osobe koja zatvara smjenu
        <input
          name="ime"
          required
          autoComplete="off"
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-2xl font-normal bg-white"
        />
      </label>

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      {nedostaje > 0 && (
        <p className="text-lg text-zinc-600">Još nije upisano završno stanje za {nedostaje} artikala.</p>
      )}
      {!potvrda ? (
        <button
          type="button"
          onClick={() => {
            if (forma.current?.reportValidity()) setPotvrda(true);
          }}
          className="min-h-20 rounded-2xl bg-brand text-3xl font-bold text-white active:bg-brand-dark"
        >
          Zatvori smjenu
        </button>
      ) : (
        <div role="alertdialog" aria-label="Potvrda zatvaranja smjene" className="flex flex-col gap-3 rounded-2xl border-2 border-brand p-4">
          <p className="text-xl font-semibold">
            Zatvarate smjenu. Potrošnja se knjiži kao trošak, a izbrojano stanje postaje početno stanje sljedeće smjene.
            Ovo se ne može vratiti.
          </p>
          {zadnja && nemaPromjena && (
            <p className="text-lg font-bold text-amber-900">
              Upozorenje: od zadnjeg zatvaranja nije bilo promjena. Da li ste sigurni?
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={radi}
              className="min-h-16 flex-1 rounded-2xl bg-brand px-6 text-2xl font-bold text-white active:bg-brand-dark disabled:opacity-50"
            >
              {radi ? "Zatvaram…" : "Da, zatvori smjenu"}
            </button>
            <button
              type="button"
              onClick={() => setPotvrda(false)}
              className="min-h-16 rounded-2xl border-2 border-zinc-300 bg-white px-8 text-2xl font-semibold active:bg-zinc-200"
            >
              Nazad
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
