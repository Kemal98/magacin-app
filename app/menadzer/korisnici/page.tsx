import Link from "next/link";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { otkljucajKorisnika, promijeniAktivnostKorisnika } from "@/app/actions/korisnici";
import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { datumVrijeme } from "@/lib/format";
import { ucitajKorisnike, type KorisnikZaUpravljanje } from "@/lib/korisnici";
import { zahtijevajUlogu, type Uloga } from "@/lib/korisnik";

export const metadata = { title: "Korisnici" };

const NAZIV_ULOGE: Record<Uloga, string> = {
  magacioner: "Magacioneri",
  objekat: "Osoblje objekata",
  menadzer: "Menadžeri",
};

export default async function KorisniciStranica() {
  const ja = await zahtijevajUlogu("menadzer");
  const korisnici = await ucitajKorisnike();
  const zakljucani = korisnici.filter((k) => k.zakljucan_do);

  return (
    <Okvir korisnik={ja} naslov="Korisnici">
      <Osvjezavac sekundi={15} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Nazad href="/menadzer" />
        <Link
          href="/menadzer/korisnici/novi"
          className="flex min-h-16 items-center rounded-2xl bg-brand px-6 text-xl font-semibold text-white active:bg-brand-dark"
        >
          Novi korisnik
        </Link>
      </div>

      {zakljucani.length > 0 && (
        <section role="status" className="rounded-2xl border-2 border-red-700 bg-red-50 p-4">
          <p className="text-xl font-bold text-red-800">Zaključani računi ({zakljucani.length})</p>
          <p className="text-lg text-red-900">
            Zaključavanje zbog previše pogrešnih PIN-ova traje 15 minuta. Račun možete odmah otključati ispod.
          </p>
        </section>
      )}

      <PretragaListe placeholder="Traži ime, ulogu, objekat, e-adresu…" grupa="[data-grupa]">
      {(["menadzer", "magacioner", "objekat"] as const).map((uloga) => {
        const grupa = korisnici.filter((k) => k.uloga === uloga);
        if (grupa.length === 0) return null;
        return (
          <section key={uloga} data-grupa className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">{NAZIV_ULOGE[uloga]}</h2>
            <ul className="flex flex-col gap-3">
              {grupa.map((k) => (
                <KorisnikRed key={k.id} k={k} jaSam={k.id === ja.id} />
              ))}
            </ul>
          </section>
        );
      })}
      </PretragaListe>
    </Okvir>
  );
}

function KorisnikRed({ k, jaSam }: { k: KorisnikZaUpravljanje; jaSam: boolean }) {
  return (
    <li
      data-red
      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 shadow-sm ${
        k.aktivan ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 text-zinc-500"
      }`}
    >
      <div className="min-w-56 flex-1">
        <p className="text-2xl font-bold">
          {k.ime}
          {jaSam && <span className="ml-2 text-lg font-normal text-zinc-500">(vi)</span>}
        </p>
        <p className="text-lg text-zinc-500">
          {k.objekat && `${k.objekat}`}
          {k.email && k.email}
          {!k.aktivan && " · isključen"}
        </p>
        {k.zakljucan_do && (
          <p className="text-lg font-bold text-red-700">
            Zaključan do {datumVrijeme(k.zakljucan_do)} ({k.neuspjesnih} pogrešnih pokušaja)
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {k.zakljucan_do && (
          <form action={otkljucajKorisnika.bind(null, k.id)}>
            <button
              type="submit"
              className="min-h-14 rounded-xl bg-red-700 px-5 text-lg font-bold text-white active:bg-red-900"
            >
              Otključaj
            </button>
          </form>
        )}
        <Link
          href={`/menadzer/korisnici/${k.id}`}
          className="flex min-h-14 items-center rounded-xl border-2 border-zinc-300 bg-white px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
        >
          Uredi
        </Link>
        {!jaSam && (
          <form action={promijeniAktivnostKorisnika.bind(null, k.id, !k.aktivan)}>
            <button
              type="submit"
              className="min-h-14 rounded-xl border-2 border-zinc-300 bg-white px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
            >
              {k.aktivan ? "Isključi" : "Uključi"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
