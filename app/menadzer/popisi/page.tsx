import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { PopisiPrikaz } from "@/app/_components/popisi-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajPopise } from "@/lib/popis";

export const metadata = { title: "Popisi magacina" };

export default async function PopisiMenadzerStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Popisi magacina">
      <Osvjezavac sekundi={15} />
      <Nazad href="/menadzer" />
      <PopisiPrikaz popisi={await ucitajPopise(50)} />
    </Okvir>
  );
}
