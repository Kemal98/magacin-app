import { odjavi } from "@/app/actions/auth";
import type { Korisnik, Uloga } from "@/lib/korisnik";

const NAZIV_ULOGE: Record<Uloga, string> = {
  magacioner: "Magacioner",
  objekat: "Objekat",
  menadzer: "Menadžer",
};

/** Zajednički okvir ekrana: ko je prijavljen, naslov ekrana i odjava. */
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
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4 border-b-2 border-zinc-200 pb-4">
        <div>
          <p className="text-lg text-zinc-500">{NAZIV_ULOGE[korisnik.uloga]}</p>
          <p className="text-2xl font-semibold">{korisnik.ime}</p>
        </div>
        <form action={odjavi}>
          <button
            type="submit"
            className="min-h-16 rounded-2xl border-2 border-zinc-300 px-6 text-xl font-semibold text-zinc-700 active:bg-zinc-200"
          >
            Odjava
          </button>
        </form>
      </header>

      <main className="flex flex-1 flex-col gap-4">
        <h1 className="text-4xl font-bold">{naslov}</h1>
        {children ?? (
          <p className="text-xl text-zinc-500">Ovdje uskoro dolaze radnje.</p>
        )}
      </main>
    </div>
  );
}
