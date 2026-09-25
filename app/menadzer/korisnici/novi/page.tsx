import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajObjekte } from "@/lib/izvjestaji";
import { KorisnikForma } from "../korisnik-forma";

export const metadata = { title: "Novi korisnik" };

export default async function NoviKorisnikStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Novi korisnik">
      <Nazad href="/menadzer/korisnici">Nazad na korisnike</Nazad>
      <KorisnikForma objekti={await ucitajObjekte()} />
    </Okvir>
  );
}
