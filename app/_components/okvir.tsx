import { odjavi } from "@/app/actions/auth";
import type { Korisnik, Uloga } from "@/lib/korisnik";
import { Ikona } from "./ikone";

const NAZIV_ULOGE: Record<Uloga, string> = {
  magacioner: "Magacioner",
  objekat: "Objekat",
  menadzer: "Menadžer",
};

/** Zajednički okvir ekrana: traka s prijavljenom osobom i odjavom, pa naslov i sadržaj ekrana. */
export function Okvir({
  korisnik,
  naslov,
  children,
}: {
  korisnik: Korisnik;
  naslov: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <Ikona ime="paket" className="size-7" />
            </span>
            <div className="leading-tight">
              <p className="text-base text-white/75">{NAZIV_ULOGE[korisnik.uloga]}</p>
              <p className="text-xl font-semibold">{korisnik.ime}</p>
            </div>
          </div>
          <form action={odjavi}>
            <button
              type="submit"
              className="flex min-h-12 items-center gap-2 rounded-xl border border-white/40 px-4 text-lg font-semibold active:bg-white/15"
            >
              <Ikona ime="izlaz" className="size-5" />
              Odjava
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
        <h1 className="text-3xl font-bold tracking-tight">{naslov}</h1>
        <main className="flex flex-1 flex-col gap-5">
          {children ?? <p className="text-xl text-zinc-500">Ovdje uskoro dolaze radnje.</p>}
        </main>
      </div>
    </div>
  );
}
