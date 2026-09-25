"use client";

import { useActionState, useState } from "react";
import { dodajKorisnika, izmijeniKorisnika } from "@/app/actions/korisnici";
import { provjeriPin } from "@/lib/korisnici-validacija";
import type { Uloga } from "@/lib/korisnik";

const POLJE = "min-h-14 w-full rounded-xl border-2 border-zinc-300 px-4 text-xl";

export type PodaciKorisnika = { id: string; ime: string; uloga: Uloga; objekat_id: string | null; email: string | null };

/** PIN koji nije jednostavan: šest slučajnih cifara koje prolaze istu provjeru kao ručni unos. */
export function noviPin(): string {
  for (;;) {
    const pin = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b % 10).join("");
    if (!provjeriPin(pin)) return pin;
  }
}

/**
 * Forma za novog korisnika (uloga se bira) ili izmjenu postojećeg (uloga je zadana). Magacioner i osoblje
 * objekta imaju PIN, menadžer e-adresu i lozinku. Pri izmjeni, prazno polje za PIN/lozinku ništa ne mijenja.
 */
export function KorisnikForma({
  objekti,
  korisnik,
}: {
  objekti: { id: string; naziv: string }[];
  korisnik?: PodaciKorisnika;
}) {
  const izmjena = korisnik !== undefined;
  const [stanje, akcija, radi] = useActionState(
    izmjena ? izmijeniKorisnika.bind(null, korisnik.id, korisnik.uloga) : dodajKorisnika,
    undefined,
  );
  const [uloga, setUloga] = useState<Uloga>(korisnik?.uloga ?? "magacioner");
  const [pin, setPin] = useState("");

  return (
    <form action={akcija} className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <label className="flex flex-col gap-1 text-lg font-semibold">
        Ime i prezime (ovako se prikazuje na prijavi)
        <input name="ime" defaultValue={korisnik?.ime} required autoComplete="off" className={POLJE} />
      </label>

      {izmjena ? (
        <input type="hidden" name="uloga" value={uloga} />
      ) : (
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Uloga
          <select name="uloga" value={uloga} onChange={(e) => setUloga(e.target.value as Uloga)} className={POLJE}>
            <option value="magacioner">Magacioner</option>
            <option value="objekat">Osoblje objekta</option>
            <option value="menadzer">Menadžer</option>
          </select>
        </label>
      )}

      {uloga === "objekat" && (
        <label className="flex flex-col gap-1 text-lg font-semibold">
          Objekat
          <select name="objekat" defaultValue={korisnik?.objekat_id ?? ""} required className={POLJE}>
            <option value="" disabled>
              Izaberite objekat
            </option>
            {objekti.map((o) => (
              <option key={o.id} value={o.id}>
                {o.naziv}
              </option>
            ))}
          </select>
        </label>
      )}

      {uloga === "menadzer" ? (
        <>
          {!izmjena && (
            <label className="flex flex-col gap-1 text-lg font-semibold">
              E-adresa (za prijavu)
              <input name="email" type="email" required autoComplete="off" className={POLJE} />
            </label>
          )}
          {izmjena && korisnik.email && <p className="text-lg text-zinc-600">E-adresa: {korisnik.email}</p>}
          <label className="flex flex-col gap-1 text-lg font-semibold">
            {izmjena ? "Nova lozinka (ostavite prazno da se ne mijenja)" : "Lozinka (najmanje 8 znakova)"}
            <input
              name="lozinka"
              type="password"
              required={!izmjena}
              autoComplete="new-password"
              className={POLJE}
            />
          </label>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-lg font-semibold">
            {izmjena ? "Novi PIN (ostavite prazno da se ne mijenja)" : "PIN (šest cifara)"}
            <div className="flex gap-3">
              <input
                name="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                required={!izmjena}
                autoComplete="off"
                className={`${POLJE} flex-1 font-mono tracking-widest`}
              />
              <button
                type="button"
                onClick={() => setPin(noviPin())}
                className="min-h-14 shrink-0 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-semibold active:bg-zinc-200"
              >
                Predloži PIN
              </button>
            </div>
          </label>
          <p className="text-base text-zinc-500">
            PIN se vidi samo sada: recite ga osobi. Ne koristite jednostavne PIN-ove (111111, 123456).
          </p>
        </div>
      )}

      {stanje?.greska && (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {stanje.greska}
        </p>
      )}
      <button
        type="submit"
        disabled={radi}
        className="min-h-16 rounded-2xl bg-brand text-2xl font-semibold text-white active:bg-brand-dark disabled:opacity-50"
      >
        {radi ? "Snimam…" : izmjena ? "Snimi izmjene" : "Dodaj korisnika"}
      </button>
    </form>
  );
}
