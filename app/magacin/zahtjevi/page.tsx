import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { ZahtjevKartica } from "@/app/_components/zahtjev-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajZahtjeve } from "@/lib/zahtjevi";
import { ZahtjevIzdavanje } from "./zahtjev-izdavanje";
import { ZahtjevObrada } from "./zahtjev-obrada";

export const metadata = { title: "Zahtjevi" };

export default async function ZahtjeviStranica() {
  const korisnik = await zahtijevajUlogu("magacioner");
  const [naCekanju, zaIzdavanje, naDostavi, obradeni] = await Promise.all([
    ucitajZahtjeve(["poslan"]),
    ucitajZahtjeve(["odobren"]),
    ucitajZahtjeve(["na_dostavi"]),
    ucitajZahtjeve(["odbijen"], 20),
  ]);
  // Najstariji čeka najduže, pa je prvi na redu.
  const poRedu = [...naCekanju].reverse();
  const zaIzdavanjePoRedu = [...zaIzdavanje].reverse();

  return (
    <Okvir korisnik={korisnik} naslov="Zahtjevi objekata">
      <Osvjezavac />
      <Link href="/magacin" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Čekaju odluku ({naCekanju.length})</h2>
        {poRedu.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema novih zahtjeva.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {poRedu.map((z) => (
              <ZahtjevObrada key={z.id} z={z} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Odobreni, čekaju izdavanje ({zaIzdavanje.length})</h2>
        {zaIzdavanjePoRedu.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema odobrenih zahtjeva za izdavanje.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {zaIzdavanjePoRedu.map((z) => (
              <ZahtjevIzdavanje key={z.id} z={z} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Na dostavi ({naDostavi.length})</h2>
        {naDostavi.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema robe na putu.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {naDostavi.map((z) => (
              <ZahtjevKartica key={z.id} z={z} pokaziObjekat />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zadnje odbijeni</h2>
        {obradeni.length === 0 ? (
          <p className="text-xl text-zinc-500">Još nema obrađenih zahtjeva.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {obradeni.map((z) => (
              <ZahtjevKartica key={z.id} z={z} pokaziObjekat />
            ))}
          </ul>
        )}
      </section>
    </Okvir>
  );
}
