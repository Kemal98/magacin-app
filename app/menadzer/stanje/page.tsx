import { Okvir } from "@/app/_components/okvir";
import { ucitajStanje } from "@/app/_components/stanje-podaci";
import { StanjeTabela } from "@/app/_components/stanje-tabela";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Stanje magacina" };

export default async function StanjeStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Stanje magacina prehrane">
      <Nazad href="/menadzer" />
      <StanjeTabela redovi={await ucitajStanje()} />
    </Okvir>
  );
}
