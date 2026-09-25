import Link from "next/link";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { Plocica } from "@/app/_components/plocica";
import { ZahtjevKartica } from "@/app/_components/zahtjev-prikaz";
import { PotvrdaPrijema } from "./potvrda-prijema";
import { kolicina as fmt } from "@/lib/format";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajTrenutnuSmjenu } from "@/lib/smjene";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { ucitajZahtjeve } from "@/lib/zahtjevi";

export const metadata = { title: "Objekat" };

export default async function ObjekatPocetna({
  searchParams,
}: {
  searchParams: Promise<{ poslano?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("objekat");
  const { poslano } = await searchParams;
  const svi = await ucitajZahtjeve(undefined, 30);
  const naDostavi = svi.filter((z) => z.status === "na_dostavi");
  const zahtjevi = svi.filter((z) => z.status !== "na_dostavi");
  const trenutna = await ucitajTrenutnuSmjenu();
  const supabase = await napraviServerKlijent();
  const { data: zalihaPodaci, error: zalihaGreska } = await supabase.rpc("zaliha_objekta");
  if (zalihaGreska) throw new Error(`Učitavanje zalihe nije uspjelo: ${zalihaGreska.message}`);
  const zaliha = zalihaPodaci as { artikal_id: string; naziv: string; mjera: string; kolicina: number | string }[];

  return (
    <Okvir korisnik={korisnik} naslov="Objekat">
      <Osvjezavac />
      {poslano && (
        <p role="status" className="rounded-2xl border border-green-700 bg-green-50 p-4 text-xl font-semibold shadow-sm">
          Zahtjev je poslan magacinu.
        </p>
      )}
      {naDostavi.length > 0 && (
        <ul className="flex flex-col gap-4">
          {naDostavi.map((z) => (
            <PotvrdaPrijema key={z.id} z={z} />
          ))}
        </ul>
      )}
      {trenutna && (
        <p className="rounded-2xl bg-zinc-100 p-3 text-xl">
          Trenutna smjena: <span className="font-bold">{trenutna.naziv}</span> ({trenutna.pocetak.slice(0, 5)}–
          {trenutna.kraj.slice(0, 5)})
        </p>
      )}
      <Link
        href="/objekat/zahtjev"
        className="flex min-h-24 items-center justify-center rounded-2xl bg-brand text-3xl font-bold text-white active:bg-brand-dark"
      >
        Novi zahtjev za robu
      </Link>
      <nav className="grid gap-3 lg:grid-cols-3">
        <Plocica href="/objekat/smjena" naslov="Zatvori smjenu" opis="Završno stanje" ikona="sat" />
        <Plocica href="/objekat/izuzetak" naslov="Izuzetak" opis="Razbijeno, proliveno…" ikona="upozorenje" />
        <Plocica href="/objekat/smjene" naslov="Prethodne smjene" opis="Šta je potrošeno" ikona="stanje" />
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zaliha objekta</h2>
        {zaliha.length === 0 ? (
          <p className="text-xl text-zinc-500">Još nema izdate robe.</p>
        ) : (
          <PretragaListe placeholder="Traži artikal u zalihi…">
          <ul className="grid gap-2 sm:grid-cols-2">
            {zaliha.map((z) => (
              <li data-red key={z.artikal_id} className="flex justify-between rounded-xl border-2 border-zinc-200 p-3 text-xl bg-white">
                <span>{z.naziv}</span>
                <span className="font-bold">
                  {fmt(Number(z.kolicina))} {z.mjera}
                </span>
              </li>
            ))}
          </ul>
          </PretragaListe>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Vaši zahtjevi</h2>
        {zahtjevi.length === 0 ? (
          <p className="text-xl text-zinc-500">Još niste poslali nijedan zahtjev.</p>
        ) : (
          <PretragaListe placeholder="Traži zahtjev, artikal, status…">
            <ul className="flex flex-col gap-3">
              {zahtjevi.map((z) => (
                <ZahtjevKartica key={z.id} z={z} />
              ))}
            </ul>
          </PretragaListe>
        )}
      </section>
    </Okvir>
  );
}
