import { Nazad } from "@/app/_components/nazad";
import { NabavkaPregled } from "@/app/_components/nabavka-prikaz";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajNabavku } from "@/lib/nabavka";
import { danasSarajevo, periodIzParametara, zadnjihDana } from "@/lib/period";

export const metadata = { title: "Nabavka" };

export default async function NabavkaStranica({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const q = await searchParams;
  const danas = danasSarajevo();
  const { od, do: kraj } = periodIzParametara(q.od, q.do, danas, zadnjihDana(90, danas));
  const redovi = await ucitajNabavku(od, kraj);
  return (
    <Okvir korisnik={korisnik} naslov="Nabavka po dobavljačima">
      <Nazad href="/menadzer" />
      <NabavkaPregled osnova="/menadzer/nabavka" redovi={redovi} od={od} do={kraj} />
    </Okvir>
  );
}
