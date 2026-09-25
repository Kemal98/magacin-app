import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajSmjene, ucitajStanjeZaZatvaranje } from "@/lib/smjene";
import { ZatvaranjeForma } from "./zatvaranje-forma";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Zatvaranje smjene" };

export default async function ZatvaranjeStranica() {
  const korisnik = await zahtijevajUlogu("objekat");
  const [redovi, zadnje] = await Promise.all([ucitajStanjeZaZatvaranje(), ucitajSmjene(undefined, 1)]);
  const zadnja = zadnje[0] ? { zatvorena: zadnje[0].zatvorena, ime: zadnje[0].ime_osobe, naziv: zadnje[0].naziv } : null;
  return (
    <Okvir korisnik={korisnik} naslov="Zatvaranje smjene">
      <Nazad href="/objekat" />
      <ZatvaranjeForma redovi={redovi} zadnja={zadnja} />
    </Okvir>
  );
}
