import { redirect } from "next/navigation";
import { POCETNA_ULOGE, trenutniKorisnik } from "@/lib/korisnik";

/** Šalje osobu na početni ekran njene uloge (ili na prijavu). */
export default async function Pocetna() {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) redirect("/prijava");
  redirect(POCETNA_ULOGE[korisnik.uloga]);
}
