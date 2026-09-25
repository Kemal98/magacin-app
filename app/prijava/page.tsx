import { redirect } from "next/navigation";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { POCETNA_ULOGE, trenutniKorisnik } from "@/lib/korisnik";
import { PrijavaEkran, type ImeZaPrijavu } from "./prijava-ekran";

export const metadata = { title: "Prijava" };

export default async function PrijavaStranica() {
  const korisnik = await trenutniKorisnik();
  if (korisnik) redirect(POCETNA_ULOGE[korisnik.uloga]);

  const supabase = await napraviServerKlijent();
  const { data } = await supabase.rpc("korisnici_za_prijavu");
  const imena = (data ?? []) as ImeZaPrijavu[];

  return <PrijavaEkran imena={imena} />;
}
