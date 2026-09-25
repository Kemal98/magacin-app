import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { ZahtjevKartica } from "@/app/_components/zahtjev-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajZahtjeve } from "@/lib/zahtjevi";

export const metadata = { title: "Objekat" };

export default async function ObjekatPocetna({
  searchParams,
}: {
  searchParams: Promise<{ poslano?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("objekat");
  const { poslano } = await searchParams;
  const zahtjevi = await ucitajZahtjeve(undefined, 30);

  return (
    <Okvir korisnik={korisnik} naslov="Objekat">
      <Osvjezavac />
      {poslano && (
        <p role="status" className="rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-xl font-semibold">
          Zahtjev je poslan magacinu.
        </p>
      )}
      <Link
        href="/objekat/zahtjev"
        className="flex min-h-24 items-center justify-center rounded-2xl bg-zinc-900 text-3xl font-bold text-white active:bg-zinc-700"
      >
        Novi zahtjev za robu
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Vaši zahtjevi</h2>
        {zahtjevi.length === 0 ? (
          <p className="text-xl text-zinc-500">Još niste poslali nijedan zahtjev.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {zahtjevi.map((z) => (
              <ZahtjevKartica key={z.id} z={z} />
            ))}
          </ul>
        )}
      </section>
    </Okvir>
  );
}
