import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Objekat" };

export default async function ObjekatPocetna() {
  const korisnik = await zahtijevajUlogu("objekat");
  return <Okvir korisnik={korisnik} naslov="Objekat" />;
}
