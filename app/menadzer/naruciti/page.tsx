import { Nazad } from "@/app/_components/nazad";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { ZaNarucitiPrikaz } from "@/app/_components/za-naruciti-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajIspodMinimuma } from "@/lib/minimum";

export const metadata = { title: "Za naručivanje" };

export default async function NarucitiMenadzerStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Za naručivanje">
      <Osvjezavac sekundi={15} />
      <Nazad href="/menadzer" />
      <PretragaListe placeholder="Traži artikal…">
        <ZaNarucitiPrikaz artikli={await ucitajIspodMinimuma()} />
      </PretragaListe>
    </Okvir>
  );
}
