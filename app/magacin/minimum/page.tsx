import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { ucitajStanje } from "@/app/_components/stanje-podaci";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { MinimumLista } from "./minimum-lista";

export const metadata = { title: "Minimum zaliha" };

export default async function MinimumStranica() {
  const korisnik = await zahtijevajUlogu("magacioner");
  const stanje = await ucitajStanje();
  return (
    <Okvir korisnik={korisnik} naslov="Minimum zaliha">
      <Nazad href="/magacin" />
      <p className="text-xl text-zinc-600">
        Upišite najmanju količinu koja treba biti na zalihi. Kad zaliha padne ispod nje, artikal se označi crveno
        i pojavi na popisu za naručivanje. Prazno polje ili 0 znači da minimum nije zadan.
      </p>
      <MinimumLista
        artikli={stanje.map((r) => ({ id: r.id, naziv: r.naziv, mjera: r.mjera, kolicina: r.kolicina, minimum: r.minimum }))}
      />
    </Okvir>
  );
}
