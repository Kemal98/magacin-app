import { ucitajStanje } from "@/app/_components/stanje-podaci";
import { stanjeUListove } from "@/lib/izvoz";
import { xlsxOdgovor } from "@/lib/izvoz-odgovor";
import { trenutniKorisnik } from "@/lib/korisnik";
import { ucitajIspodMinimuma } from "@/lib/minimum";
import { danasSarajevo } from "@/lib/period";
import { napraviXlsx } from "@/lib/xlsx-pisanje";

/** Stanje magacina s vrijednošću i popis za naručivanje; magacioner i menadžer. */
export async function GET() {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return new Response("Niste prijavljeni.", { status: 401 });
  if (korisnik.uloga !== "magacioner" && korisnik.uloga !== "menadzer") {
    return new Response("Nemate pravo na ovu radnju.", { status: 403 });
  }
  const [stanje, zaNaruciti] = await Promise.all([ucitajStanje(), ucitajIspodMinimuma()]);
  return xlsxOdgovor(napraviXlsx(stanjeUListove(stanje, zaNaruciti)), `magacin-stanje-${danasSarajevo()}.xlsx`);
}
