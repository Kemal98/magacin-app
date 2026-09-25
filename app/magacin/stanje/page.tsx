import { IzvozDugme } from "@/app/_components/izvoz-dugme";
import { Okvir } from "@/app/_components/okvir";
import { ucitajStanje } from "@/app/_components/stanje-podaci";
import { StanjeTabela } from "@/app/_components/stanje-tabela";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Stanje magacina" };

export default async function StanjeStranica() {
  const korisnik = await zahtijevajUlogu("magacioner");
  return (
    <Okvir korisnik={korisnik} naslov="Stanje magacina prehrane">
      <Nazad href="/magacin" />
      <IzvozDugme href="/izvoz/stanje" />
      <StanjeTabela redovi={await ucitajStanje()} />
    </Okvir>
  );
}
