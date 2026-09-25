import Link from "next/link";
import { notFound } from "next/navigation";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { PopisArtikala } from "./popis-artikala";

export const metadata = { title: "Artikli objekta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PopisObjektaStranica({ params }: { params: Promise<{ id: string }> }) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await napraviServerKlijent();
  const [objekat, artikli, popis] = await Promise.all([
    supabase.from("objekat").select("naziv").eq("id", id).maybeSingle(),
    supabase.from("artikal").select("id, naziv, mjera, vrsta").eq("aktivan", true).order("naziv"),
    supabase.from("objekat_artikal").select("artikal_id").eq("objekat_id", id),
  ]);
  for (const r of [objekat, artikli, popis]) {
    if (r.error) throw new Error(`Učitavanje nije uspjelo: ${r.error.message}`);
  }
  if (!objekat.data) notFound();

  return (
    <Okvir korisnik={korisnik} naslov={`Artikli: ${objekat.data.naziv}`}>
      <Link href="/menadzer/objekti" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad na objekte
      </Link>
      <PopisArtikala
        objekatId={id}
        artikli={artikli.data!}
        izabrani={popis.data!.map((p) => p.artikal_id)}
      />
    </Okvir>
  );
}
