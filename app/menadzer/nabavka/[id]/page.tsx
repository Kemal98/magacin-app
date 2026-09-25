import { notFound } from "next/navigation";
import { Nazad } from "@/app/_components/nazad";
import { NabavkaDobavljac } from "@/app/_components/nabavka-prikaz";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajArtikleDobavljaca, ucitajIsporuke, ucitajNabavku } from "@/lib/nabavka";
import { danasSarajevo, periodIzParametara, zadnjihDana } from "@/lib/period";

export const metadata = { title: "Dobavljač: nabavka" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NabavkaDobavljacaStranica({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ od?: string; do?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const q = await searchParams;
  const danas = danasSarajevo();
  const { od, do: kraj } = periodIzParametara(q.od, q.do, danas, zadnjihDana(90, danas));
  const [pregled, isporuke, artikli] = await Promise.all([
    ucitajNabavku(od, kraj),
    ucitajIsporuke(id, od, kraj),
    ucitajArtikleDobavljaca(id, od, kraj),
  ]);
  const dobavljac = pregled.find((d) => d.dobavljac_id === id);
  if (!dobavljac) notFound();
  return (
    <Okvir korisnik={korisnik} naslov={dobavljac.naziv}>
      <Nazad href="/menadzer/nabavka">Nazad na dobavljače</Nazad>
      <NabavkaDobavljac osnova="/menadzer/nabavka" id={id} dobavljac={dobavljac} isporuke={isporuke} artikli={artikli} od={od} do={kraj} />
    </Okvir>
  );
}
