import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { PopisiPrikaz } from "@/app/_components/popisi-prikaz";
import type { ArtikalZaUnos } from "@/lib/bar-kod";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajPopise } from "@/lib/popis";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { PopisForma } from "./popis-forma";

export const metadata = { title: "Popis magacina" };

export default async function PopisStranica({
  searchParams,
}: {
  searchParams: Promise<{ potvrdjeno?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("magacioner");
  const { potvrdjeno } = await searchParams;
  const supabase = await napraviServerKlijent();
  const [artikliRes, popisi] = await Promise.all([
    supabase
      .from("artikal")
      .select("id, naziv, mjera, bar_kod, pakovanje(id, naziv, faktor, bar_kod)")
      .eq("vrsta", "prehrana")
      .eq("aktivan", true)
      .order("naziv"),
    ucitajPopise(10),
  ]);
  if (artikliRes.error) throw new Error(`Učitavanje nije uspjelo: ${artikliRes.error.message}`);
  const artikli: ArtikalZaUnos[] = artikliRes.data.map((a) => ({
    id: a.id,
    naziv: a.naziv,
    mjera: a.mjera,
    bar_kod: a.bar_kod,
    pakovanja: a.pakovanje.map((p) => ({ id: p.id, naziv: p.naziv, faktor: Number(p.faktor), bar_kod: p.bar_kod })),
  }));

  return (
    <Okvir korisnik={korisnik} naslov="Popis magacina">
      <Nazad href="/magacin" />
      {potvrdjeno && (
        <p role="status" className="rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-xl font-semibold">
          Popis je potvrđen i stanje magacina je usklađeno.
        </p>
      )}
      <PopisForma artikli={artikli} />
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zadnji popisi</h2>
        <PopisiPrikaz popisi={popisi} />
      </section>
    </Okvir>
  );
}
