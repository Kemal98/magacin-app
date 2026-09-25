import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Menadžer" };

export default async function MenadzerPocetna() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return <Okvir korisnik={korisnik} naslov="Pregled" />;
}
