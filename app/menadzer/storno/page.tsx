import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajRadnjeZaStorno } from "@/lib/storno";
import { StornoLista } from "./storno-lista";

export const metadata = { title: "Storno" };

export default async function StornoStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Storno: poništavanje greške">
      <Nazad href="/menadzer" />
      <p className="text-xl text-zinc-600">
        Pogrešan prijem, izdavanje ili otpis možete poništiti uz razlog. Stanje se vraća, a original ostaje u
        evidenciji uz oznaku storna: ništa se ne briše niti mijenja.
      </p>
      <StornoLista radnje={await ucitajRadnjeZaStorno(100)} />
    </Okvir>
  );
}
