import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { UvozEkran } from "./uvoz-ekran";

export const metadata = { title: "Uvoz iz Excela" };

export default async function UvozStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Uvoz iz Excela">
      <Link href="/menadzer" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>
      <UvozEkran />
    </Okvir>
  );
}
