import { notFound } from "next/navigation";
import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { ucitajObjekte } from "@/lib/izvjestaji";
import { ucitajKorisnike } from "@/lib/korisnici";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { KorisnikForma } from "../korisnik-forma";

export const metadata = { title: "Izmjena korisnika" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IzmjenaKorisnikaStranica({ params }: { params: Promise<{ id: string }> }) {
  const ja = await zahtijevajUlogu("menadzer");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [korisnici, objekti] = await Promise.all([ucitajKorisnike(), ucitajObjekte()]);
  const k = korisnici.find((x) => x.id === id);
  if (!k) notFound();
  return (
    <Okvir korisnik={ja} naslov={`Izmjena: ${k.ime}`}>
      <Nazad href="/menadzer/korisnici">Nazad na korisnike</Nazad>
      <KorisnikForma
        objekti={objekti}
        korisnik={{ id: k.id, ime: k.ime, uloga: k.uloga, objekat_id: k.objekat_id, email: k.email }}
      />
    </Okvir>
  );
}
