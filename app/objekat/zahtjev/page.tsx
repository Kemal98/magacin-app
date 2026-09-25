import { Okvir } from "@/app/_components/okvir";
import type { ArtikalZaUnos } from "@/lib/bar-kod";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { ZahtjevForma } from "./zahtjev-forma";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Novi zahtjev" };

type ArtikalIzBaze = {
  id: string;
  naziv: string;
  mjera: string;
  bar_kod: string | null;
  pakovanja: { id: string; naziv: string; faktor: number; bar_kod: string | null }[];
};

export default async function NoviZahtjevStranica() {
  const korisnik = await zahtijevajUlogu("objekat");
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("artikli_objekta");
  if (error) throw new Error(error.message);
  const artikli: ArtikalZaUnos[] = (data as ArtikalIzBaze[]).map((a) => ({
    id: a.id,
    naziv: a.naziv,
    mjera: a.mjera,
    bar_kod: a.bar_kod,
    pakovanja: a.pakovanja.map((p) => ({ ...p, faktor: Number(p.faktor) })),
  }));

  return (
    <Okvir korisnik={korisnik} naslov="Novi zahtjev">
      <Nazad href="/objekat" />
      {artikli.length === 0 ? (
        <p className="text-xl text-zinc-500">Menadžer još nije zadao artikle za vaš objekat.</p>
      ) : (
        <ZahtjevForma artikli={artikli} />
      )}
    </Okvir>
  );
}
