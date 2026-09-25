import Link from "next/link";
import { notFound } from "next/navigation";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { ArtikalForma, type ArtikalPodaci } from "./artikal-forma";

export const metadata = { title: "Artikal" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ArtikalStranica({ params }: { params: Promise<{ id: string }> }) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const { id } = await params;

  let artikal: ArtikalPodaci | undefined;
  if (id !== "novi") {
    if (!UUID.test(id)) notFound();
    const supabase = await napraviServerKlijent();
    const { data, error } = await supabase
      .from("artikal")
      .select("id, naziv, mjera, bar_kod, minimum, vrsta, pakovanje(id, naziv, faktor, bar_kod)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);
    if (!data) notFound();
    artikal = {
      id: data.id,
      naziv: data.naziv,
      mjera: data.mjera,
      bar_kod: data.bar_kod ?? "",
      minimum: Number(data.minimum),
      vrsta: data.vrsta,
      pakovanja: data.pakovanje.map((p) => ({
        id: p.id,
        naziv: p.naziv,
        faktor: String(Number(p.faktor)),
        bar_kod: p.bar_kod ?? "",
      })),
    };
  }

  return (
    <Okvir korisnik={korisnik} naslov={artikal ? "Izmjena artikla" : "Novi artikal"}>
      <Link href="/menadzer/artikli" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad na artikle
      </Link>
      <ArtikalForma artikal={artikal} />
    </Okvir>
  );
}
