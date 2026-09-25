import { Okvir } from "@/app/_components/okvir";
import { SmjenaKartica } from "@/app/_components/smjena-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajSmjene } from "@/lib/smjene";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Prethodne smjene" };

export default async function PrethodneSmjeneStranica({
  searchParams,
}: {
  searchParams: Promise<{ zatvorena?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("objekat");
  const { zatvorena } = await searchParams;
  const smjene = await ucitajSmjene(undefined, 20);
  return (
    <Okvir korisnik={korisnik} naslov="Prethodne smjene">
      <Nazad href="/objekat" />
      {zatvorena && (
        <p role="status" className="rounded-2xl border border-green-700 bg-green-50 p-4 text-xl font-semibold shadow-sm">
          Smjena je zatvorena.
        </p>
      )}
      {smjene.length === 0 ? (
        <p className="text-xl text-zinc-500">Još nema zatvorenih smjena.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {smjene.map((s) => (
            <SmjenaKartica key={s.id} s={s} />
          ))}
        </ul>
      )}
    </Okvir>
  );
}
