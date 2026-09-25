import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Magacin" };

export default async function MagacinPocetna() {
  const korisnik = await zahtijevajUlogu("magacioner");
  return <Okvir korisnik={korisnik} naslov="Magacin prehrane" />;
}
