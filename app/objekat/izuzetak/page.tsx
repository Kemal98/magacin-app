import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { datumVrijeme, kolicina as fmt } from "@/lib/format";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajIzuzetke, ucitajStanjeZaZatvaranje } from "@/lib/smjene";
import { IzuzetakForma } from "./izuzetak-forma";

export const metadata = { title: "Izuzetak" };

export default async function IzuzetakStranica({
  searchParams,
}: {
  searchParams: Promise<{ dodano?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("objekat");
  const { dodano } = await searchParams;
  const [redovi, izuzeci] = await Promise.all([ucitajStanjeZaZatvaranje(), ucitajIzuzetke()]);
  const artikli = redovi.filter((r) => r.moguce > 0).map((r) => ({ id: r.artikal_id, naziv: r.naziv, mjera: r.mjera, moguce: r.moguce }));

  return (
    <Okvir korisnik={korisnik} naslov="Izuzetak (razbijeno, proliveno…)">
      <Link href="/objekat" className="text-2xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>
      {dodano && (
        <p role="status" className="rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-xl font-semibold">
          Izuzetak je zabilježen.
        </p>
      )}
      <IzuzetakForma artikli={artikli} />

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Izuzeci u ovoj smjeni</h2>
        {izuzeci.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema izuzetaka.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {izuzeci.map((i, n) => (
              <li key={n} className="rounded-xl border-2 border-zinc-200 p-3 text-xl">
                <span className="font-semibold">{i.artikal}</span>: {fmt(Number(i.kolicina))} {i.mjera}, {i.razlog}
                <span className="block text-lg text-zinc-500">{datumVrijeme(i.vrijeme)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Okvir>
  );
}
