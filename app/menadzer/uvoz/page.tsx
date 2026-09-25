import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { UvozEkran } from "./uvoz-ekran";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Uvoz iz Excela" };

export default async function UvozStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Uvoz iz Excela">
      <Nazad href="/menadzer" />
      <UvozEkran />
    </Okvir>
  );
}
