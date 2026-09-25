import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajStanjeZaZatvaranje } from "@/lib/smjene";
import { ZatvaranjeForma } from "./zatvaranje-forma";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Zatvaranje smjene" };

export default async function ZatvaranjeStranica() {
  const korisnik = await zahtijevajUlogu("objekat");
  const redovi = await ucitajStanjeZaZatvaranje();
  return (
    <Okvir korisnik={korisnik} naslov="Zatvaranje smjene">
      <Nazad href="/objekat" />
      <ZatvaranjeForma redovi={redovi} />
    </Okvir>
  );
}
