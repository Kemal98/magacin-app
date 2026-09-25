import { Okvir } from "@/app/_components/okvir";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { RazlikePrikaz } from "@/app/_components/razlike-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajRazlike } from "@/lib/razlike";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Razlike pri prijemu" };

export default async function RazlikeStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Razlike pri prijemu">
      <Osvjezavac sekundi={15} />
      <Nazad href="/menadzer" />
      <PretragaListe placeholder="Traži objekat, artikal, osobu…">
        <RazlikePrikaz razlike={await ucitajRazlike()} />
      </PretragaListe>
    </Okvir>
  );
}
