import Link from "next/link";
import { notFound } from "next/navigation";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajRaspored } from "@/lib/smjene";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { RasporedForma } from "./raspored-forma";

export const metadata = { title: "Smjene objekta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RasporedStranica({ params }: { params: Promise<{ id: string }> }) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await napraviServerKlijent();
  const { data: objekat, error } = await supabase.from("objekat").select("naziv").eq("id", id).maybeSingle();
  if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);
  if (!objekat) notFound();
  const raspored = await ucitajRaspored(id);

  return (
    <Okvir korisnik={korisnik} naslov={`Smjene: ${objekat.naziv}`}>
      <Link href="/menadzer/objekti" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad na objekte
      </Link>
      <RasporedForma
        objekatId={id}
        pocetni={raspored.map((r) => ({ naziv: r.naziv, pocetak: r.pocetak.slice(0, 5), kraj: r.kraj.slice(0, 5) }))}
      />
    </Okvir>
  );
}
