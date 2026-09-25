import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { SmjenaKartica } from "@/app/_components/smjena-prikaz";
import { datumVrijeme, km, kolicina as fmt } from "@/lib/format";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajSmjene, ucitajUpozorenja } from "@/lib/smjene";

export const metadata = { title: "Smjene i potrošnja" };

export default async function SmjeneStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const [smjene, upozorenja] = await Promise.all([ucitajSmjene(undefined, 30), ucitajUpozorenja(20)]);
  return (
    <Okvir korisnik={korisnik} naslov="Smjene i potrošnja">
      <Osvjezavac sekundi={15} />
      <Link href="/menadzer" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Upozorenja: više nego moguće ({upozorenja.length})</h2>
        {upozorenja.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema upozorenja.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upozorenja.map((u, i) => (
              <li key={`${u.smjena_id}-${u.artikal}-${i}`} className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-xl">
                <p className="font-bold">
                  {u.objekat}: {u.artikal} (+{fmt(Number(u.visak))} {u.mjera}, {km(Number(u.vrijednost))})
                </p>
                <p>Razlog: {u.razlog}</p>
                <p className="text-lg text-zinc-600">
                  Smjenu zatvorio: {u.ime_osobe}, {datumVrijeme(u.zatvorena)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zatvorene smjene</h2>
        {smjene.length === 0 ? (
          <p className="text-xl text-zinc-500">Još nema zatvorenih smjena.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {smjene.map((s) => (
              <SmjenaKartica key={s.id} s={s} pokaziObjekat />
            ))}
          </ul>
        )}
      </section>
    </Okvir>
  );
}
