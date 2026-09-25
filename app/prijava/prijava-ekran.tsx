"use client";

import { useActionState, useState, useTransition } from "react";
import { prijaviMenadzera, prijaviPinom } from "@/app/actions/auth";

export type ImeZaPrijavu = {
  id: string;
  ime: string;
  uloga: "magacioner" | "objekat";
};

const PIN_DUZINA = 6;
const TIPKE = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const NASLOV_ULOGE = {
  magacioner: "Magacin",
  objekat: "Objekat",
} as const;

type Korak = "imena" | "pin" | "menadzer";

export function PrijavaEkran({ imena }: { imena: ImeZaPrijavu[] }) {
  const [korak, setKorak] = useState<Korak>("imena");
  const [izabrano, setIzabrano] = useState<ImeZaPrijavu | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="text-center text-4xl font-bold">Prijava</h1>

      {korak === "imena" && (
        <ImenaKorak
          imena={imena}
          naIzbor={(ime) => {
            setIzabrano(ime);
            setKorak("pin");
          }}
          naMenadzera={() => setKorak("menadzer")}
        />
      )}

      {korak === "pin" && izabrano && (
        <PinKorak ime={izabrano} nazad={() => setKorak("imena")} />
      )}

      {korak === "menadzer" && (
        <MenadzerKorak nazad={() => setKorak("imena")} />
      )}
    </main>
  );
}

function ImenaKorak({
  imena,
  naIzbor,
  naMenadzera,
}: {
  imena: ImeZaPrijavu[];
  naIzbor: (ime: ImeZaPrijavu) => void;
  naMenadzera: () => void;
}) {
  return (
    <>
      <p className="text-center text-xl text-zinc-600">Izaberite svoje ime</p>

      {(["magacioner", "objekat"] as const).map((uloga) => {
        const grupa = imena.filter((i) => i.uloga === uloga);
        if (grupa.length === 0) return null;
        return (
          <section key={uloga} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-500">
              {NASLOV_ULOGE[uloga]}
            </h2>
            {grupa.map((ime) => (
              <button
                key={ime.id}
                type="button"
                onClick={() => naIzbor(ime)}
                className="min-h-20 rounded-2xl bg-blue-600 px-6 text-2xl font-semibold text-white active:bg-blue-800"
              >
                {ime.ime}
              </button>
            ))}
          </section>
        );
      })}

      {imena.length === 0 && (
        <p className="text-center text-xl text-zinc-600">
          Nema korisnika za prijavu. Obratite se menadžeru.
        </p>
      )}

      <button
        type="button"
        onClick={naMenadzera}
        className="mt-4 min-h-16 rounded-2xl border-2 border-zinc-300 px-6 text-xl font-semibold text-zinc-700 active:bg-zinc-200"
      >
        Prijava menadžera
      </button>
    </>
  );
}

function PinKorak({
  ime,
  nazad,
}: {
  ime: ImeZaPrijavu;
  nazad: () => void;
}) {
  const [pin, setPin] = useState("");
  const [greska, setGreska] = useState<string | undefined>();
  const [radi, pokreni] = useTransition();

  function unesi(cifra: string) {
    if (radi || pin.length >= PIN_DUZINA) return;
    const novi = pin + cifra;
    setPin(novi);
    setGreska(undefined);
    if (novi.length === PIN_DUZINA) {
      pokreni(async () => {
        const rezultat = await prijaviPinom(ime.id, novi);
        // Uspjeh preusmjerava; ako smo ovdje, prijava nije uspjela.
        setGreska(rezultat?.greska);
        setPin("");
      });
    }
  }

  return (
    <>
      <p className="text-center text-2xl font-semibold">{ime.ime}</p>
      <p className="text-center text-xl text-zinc-600">Unesite PIN</p>

      <div
        className="flex justify-center gap-3"
        role="status"
        aria-label={`Uneseno ${pin.length} od ${PIN_DUZINA} cifara`}
      >
        {Array.from({ length: PIN_DUZINA }, (_, i) => (
          <span
            key={i}
            className={`size-6 rounded-full border-2 ${
              i < pin.length ? "border-blue-600 bg-blue-600" : "border-zinc-400"
            }`}
          />
        ))}
      </div>

      <p className="min-h-8 text-center text-xl text-red-600" role="alert">
        {greska}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {TIPKE.map((cifra) => (
          <Tipka key={cifra} onClick={() => unesi(cifra)} radi={radi}>
            {cifra}
          </Tipka>
        ))}
        <Tipka onClick={nazad} radi={radi} sporedna>
          Nazad
        </Tipka>
        <Tipka onClick={() => unesi("0")} radi={radi}>
          0
        </Tipka>
        <Tipka
          onClick={() => setPin((p) => p.slice(0, -1))}
          radi={radi}
          sporedna
        >
          Briši
        </Tipka>
      </div>
    </>
  );
}

function Tipka({
  children,
  onClick,
  radi,
  sporedna,
}: {
  children: React.ReactNode;
  onClick: () => void;
  radi: boolean;
  sporedna?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={radi}
      className={`min-h-20 rounded-2xl text-3xl font-semibold disabled:opacity-50 ${
        sporedna
          ? "bg-zinc-200 text-xl text-zinc-700 active:bg-zinc-300"
          : "bg-zinc-100 text-zinc-900 active:bg-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function MenadzerKorak({ nazad }: { nazad: () => void }) {
  const [stanje, akcija, radi] = useActionState(prijaviMenadzera, undefined);

  return (
    <form action={akcija} className="flex flex-col gap-4">
      <p className="text-center text-xl text-zinc-600">Prijava menadžera</p>

      <label className="flex flex-col gap-2 text-lg font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-xl font-normal"
        />
      </label>

      <label className="flex flex-col gap-2 text-lg font-medium">
        Lozinka
        <input
          name="lozinka"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-16 rounded-2xl border-2 border-zinc-300 px-4 text-xl font-normal"
        />
      </label>

      <p className="min-h-8 text-center text-xl text-red-600" role="alert">
        {stanje?.greska}
      </p>

      <button
        type="submit"
        disabled={radi}
        className="min-h-20 rounded-2xl bg-blue-600 px-6 text-2xl font-semibold text-white active:bg-blue-800 disabled:opacity-50"
      >
        Prijavi se
      </button>
      <button
        type="button"
        onClick={nazad}
        className="min-h-16 rounded-2xl border-2 border-zinc-300 px-6 text-xl font-semibold text-zinc-700 active:bg-zinc-200"
      >
        Nazad
      </button>
    </form>
  );
}
