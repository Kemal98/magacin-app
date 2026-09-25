import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { OtpisiPrikaz } from "@/app/_components/otpis-prikaz";
import { km } from "@/lib/format";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajOtpise } from "@/lib/otpis";

export const metadata = { title: "Otpis magacina" };

export default async function OtpisMenadzerStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const otpisi = await ucitajOtpise(100);
  const ukupno = otpisi.reduce((z, o) => z + Number(o.vrijednost), 0);
  return (
    <Okvir korisnik={korisnik} naslov="Otpis magacina">
      <Osvjezavac sekundi={15} />
      <Nazad href="/menadzer" />
      <p className="text-2xl font-bold">
        Vrijednost prikazanih otpisa: <span className="text-red-700">{km(ukupno)}</span>{" "}
        <span className="text-lg font-normal text-zinc-500">({otpisi.length} zadnjih unosa)</span>
      </p>
      <OtpisiPrikaz otpisi={otpisi} />
    </Okvir>
  );
}
